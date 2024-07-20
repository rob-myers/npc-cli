
declare module "lodash.clonedeep" {
  /**
   * This method is like _.clone except that it recursively clones value.
   *
   * @param value The value to recursively clone.
   * @return Returns the deep cloned value.
   */
  export default function cloneDeep<T>(value: T): T;
}
