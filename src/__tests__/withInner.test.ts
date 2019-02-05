import { withInner } from '../withInner';

describe('withInner', () => {
  const object = { test: 1 };
  const innerComponent = { hello: 2 };
  const objectWithInner = withInner(object, { innerComponent });

  it('adds inner structure to the object', () => {
    expect(objectWithInner.inner.innerComponent).toEqual(innerComponent);
  });

  it('throws an error if an attempt to change readonly attr was performed', () => {
    const assignValue = () => ((objectWithInner.inner as any).innerComponent = 'new value');
    expect(assignValue).toThrow();
  });
});
