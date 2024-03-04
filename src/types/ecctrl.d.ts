declare module "ecctrl" {
  import type { RigidBodyProps, RapierRigidBody } from "@react-three/rapier";

  export interface EcctrlProps extends RigidBodyProps {
    children?: ReactNode;
    debug?: boolean;
    capsuleHalfHeight?: number;
    capsuleRadius?: number;
    floatHeight?: number;
    characterInitDir?: number;
    followLight?: boolean;
    disableFollowCam?: boolean;
    disableFollowCamPos?: { x: number; y: number; z: number };
    disableFollowCamTarget?: { x: number; y: number; z: number };
    // Follow camera setups
    camInitDis?: number;
    camMaxDis?: number;
    camMinDis?: number;
    camInitDir?: { x: number; y: number; z: number };
    camTargetPos?: { x: number; y: number; z: number };
    camMoveSpeed?: number;
    camZoomSpeed?: number;
    camCollision?: boolean;
    camCollisionOffset?: number;
    // Follow light setups
    followLightPos?: { x: number; y: number; z: number };
    // Base control setups
    maxVelLimit?: number;
    turnVelMultiplier?: number;
    turnSpeed?: number;
    sprintMult?: number;
    jumpVel?: number;
    jumpForceToGroundMult?: number;
    slopJumpMult?: number;
    sprintJumpMult?: number;
    airDragMultiplier?: number;
    dragDampingC?: number;
    accDeltaTime?: number;
    rejectVelMult?: number;
    moveImpulsePointY?: number;
    camFollowMult?: number;
    fallingGravityScale?: number;
    fallingMaxVel?: number;
    wakeUpDelay?: number;
    // Floating Ray setups
    rayOriginOffest?: { x: number; y: number; z: number };
    rayHitForgiveness?: number;
    rayLength?: number;
    rayDir?: { x: number; y: number; z: number };
    floatingDis?: number;
    springK?: number;
    dampingC?: number;
    // Slope Ray setups
    showSlopeRayOrigin?: boolean;
    slopeMaxAngle?: number;
    slopeRayOriginOffest?: number;
    slopeRayLength?: number;
    slopeRayDir?: { x: number; y: number; z: number };
    slopeUpExtraForce?: number;
    slopeDownExtraForce?: number;
    // Head Ray setups
    showHeadRayOrigin?: boolean;
    headRayOriginOffest?: number;
    headRayLength?: number;
    headRayDir?: { x: number; y: number; z: number };
    // AutoBalance Force setups
    autoBalance?: boolean;
    autoBalanceSpringK?: number;
    autoBalanceDampingC?: number;
    autoBalanceSpringOnY?: number;
    autoBalanceDampingOnY?: number;
    // Animation temporary setups
    animated?: boolean;
    // Mode setups
    mode?: string;
    // Controller setups
    controllerKeys?: {
      forward?: number;
      backward?: number;
      leftward?: number;
      rightward?: number;
      jump?: number;
      action1?: number;
      action2?: number;
      action3?: number;
      action4?: number;
    };
    // Other rigibody props from parent
    props?: RigidBodyProps;
  }

  export = React.ForwardRefExoticComponent<EcctrlProps & React.RefAttributes<RapierRigidBody>>;
}
