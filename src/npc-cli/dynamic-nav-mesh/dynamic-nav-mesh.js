import {
    Detour,
    NavMesh,
    NavMeshParams,
    UnsignedCharArray,
    recastConfigDefaults,
    statusFailed,
    statusToReadableString,
} from 'recast-navigation'
import * as THREE from 'three'
import { buildConfig } from './build-tile'

export class DynamicTiledNavMesh {
    // onNavMeshUpdate = new Topic<[version: number, tile: [x: number, y: number]]>()
    
    /** @type {[min: THREE.Vector3Tuple, max: THREE.Vector3Tuple]} */ navMeshBounds;
    /** @type {NavMesh} */navMesh;
    navMeshVersion = 0

    /** @type {THREE.Vector3} */navMeshBoundsMin;
    /** @type {THREE.Vector3} */navMeshBoundsMax;
    /** @type {THREE.Vector3} */navMeshOrigin;

    /** @type {number} */tileWidth;
    /** @type {number} */tileHeight;
    /** @type {number} */tcs;

    /** @type {import('recast-navigation').RecastConfig} */recastConfig;

    /**
     * @param {DynamicTiledNavMeshProps} props
     * @param {import('../world/World').State} w
     */
    constructor(props, w) {
        /** @type {import('../world/World').State} */
        this.w = w;

        const navMeshBoundsMin = props.navMeshBounds.min
        const navMeshBoundsMax = props.navMeshBounds.max
        const navMeshBounds = /** @type {[min: THREE.Vector3Tuple, max: THREE.Vector3Tuple]} */ (
          [navMeshBoundsMin.toArray(), navMeshBoundsMax.toArray()]
        );
        const navMeshOrigin = props.navMeshBounds.min

        this.navMeshBoundsMin = navMeshBoundsMin
        this.navMeshBoundsMax = navMeshBoundsMax
        this.navMeshBounds = navMeshBounds
        this.navMeshOrigin = navMeshOrigin

        const recastConfig = {
            ...recastConfigDefaults,
            ...props.recastConfig,
        }

        this.recastConfig = recastConfig

        const navMesh = new NavMesh()

        const { tileWidth, tileHeight, tcs, maxPolysPerTile } = buildConfig({ recastConfig, navMeshBounds })
        this.tileWidth = tileWidth
        this.tileHeight = tileHeight
        this.tcs = tcs

        const navMeshParams = NavMeshParams.create({
            orig: navMeshOrigin,
            tileWidth: recastConfig.tileSize * recastConfig.cs,
            tileHeight: recastConfig.tileSize * recastConfig.cs,
            maxTiles: props.maxTiles,
            maxPolys: maxPolysPerTile,
        })

        navMesh.initTiled(navMeshParams)

        this.navMesh = navMesh
    }

    /**
     * 🚧 call from WorldWorkers on receive message from worker
     * @param {WW.BuildTileResponse} e 
     */
    onWorkerMessage(e) {
        const { tileX, tileY, navMeshData: serialisedNavMeshData } = e;

        const navMeshData = new UnsignedCharArray()
        navMeshData.copy(serialisedNavMeshData)

        this.navMesh.removeTile(this.navMesh.getTileRefAt(tileX, tileY, 0))
        const addTileResult = this.navMesh.addTile(navMeshData, Detour.DT_TILE_FREE_DATA, 0)

        if (statusFailed(addTileResult.status)) {
            console.error(`Failed to add tile to nav mesh at [${
                tileX
            }, ${
                tileY
            }], status: ${addTileResult.status} (${statusToReadableString(addTileResult.status)}`)

            navMeshData.destroy()
        }

        this.navMeshVersion++
        // this.onNavMeshUpdate.emit(this.navMeshVersion, [tileX, tileY])
    }

    /**
     * 🚧 see getPositionsAndIndices in @recast-navigation/three
     * 
     * @param {Float32Array} positions 
     * @param {Uint32Array} indices 
     * @param {[number, number]} param2 
     */
    buildTile(positions, indices, [tileX, tileY]) {
        const clonedPositions = new Float32Array(positions)
        const clonedIndices = new Uint32Array(indices)

        /** @type {THREE.Vector3Tuple} */
        const tileBoundsMin = [
            this.navMeshBoundsMin.x + tileX * this.tcs,
            this.navMeshBoundsMin.y,
            this.navMeshBoundsMin.z + tileY * this.tcs,
        ]

        /** @type {THREE.Vector3Tuple} */
        const tileBoundsMax = [
            this.navMeshBoundsMax.x + (tileX + 1) * this.tcs,
            this.navMeshBoundsMax.y,
            this.navMeshBoundsMax.z + (tileY + 1) * this.tcs,
        ]

        /** @type {import('./build-tile').BuildTileMeshProps} */
        const job = {
            tileX,
            tileY,
            tileBoundsMin: tileBoundsMin,
            tileBoundsMax: tileBoundsMax,
            recastConfig: this.recastConfig,
            navMeshBounds: this.navMeshBounds,
            keepIntermediates: false,
            positions: clonedPositions,
            indices: clonedIndices,
        }

        // 🚧 handle this inside nav.worker
        this.w.nav.worker.postMessage({
            type: 'build-tile',
            job,
        }, [clonedPositions.buffer, clonedIndices.buffer]);
    }

    // /**
    //  * @param {Float32Array} positions 
    //  * @param {Uint32Array} indices 
    //  */
    // buildAllTiles(positions, indices) {
    //     const { tileWidth, tileHeight } = this

    //     for (let y = 0; y < tileHeight; y++) {
    //         for (let x = 0; x < tileWidth; x++) {
    //             this.buildTile(positions, indices, [x, y])
    //         }
    //     }
    // }

    /**
     * @param {THREE.Vector3} worldPosition 
     */
    getTileForWorldPosition(worldPosition) {
        const x = Math.floor((worldPosition.x - this.navMeshBoundsMin.x) / this.tcs)
        const y = Math.floor((worldPosition.z - this.navMeshBoundsMin.z) / this.tcs)

        return /** @type {[number, number]} */ ([x, y]);
    }

    /**
     * @param {THREE.Box3} bounds 
     */
    getTilesForBounds(bounds) {
        const min = this.getTileForWorldPosition(bounds.min)
        const max = this.getTileForWorldPosition(bounds.max)

        const tiles = /** @type {[number, number][]} */ ([])

        for (let y = min[1]; y <= max[1]; y++) {
            for (let x = min[0]; x <= max[0]; x++) {
                tiles.push([x, y])
            }
        }

        return tiles
    }

    destroy() {
        this.navMesh.destroy()
    }
}

/**
 * @typedef DynamicTiledNavMeshProps
 * @property {THREE.Box3} navMeshBounds
 * @property {Partial<import('@recast-navigation/generators').TileCacheGeneratorConfig>} recastConfig
 * @property {number} maxTiles
 */
