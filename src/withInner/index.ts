export interface Inner {
  [componentName: string]: any;
}

/**
 * HOC which adds a static inner prop to the component
 * @param component React Component
 * @param inner key-value pairs. Key is a component name. Value - component itself.
 * @example
 * const ComponentWithInner = withInner(Component, { InnerComponent1, InnerComponent2 });
 */

export function withInner<Component, T extends Inner>(component: Component, inner: T) {
  const readonly: Readonly<T> = Object.defineProperties(
    {},
    {
      ...Object.keys(inner).reduce((result: any, name: string) => {
        result[name] = {
          configurable: false,
          enumerable: true,
          get() {
            return inner[name];
          },
        };

        return result;
      }, {}),
    },
  );

  return Object.assign(component, {
    inner: readonly,
  });
}
