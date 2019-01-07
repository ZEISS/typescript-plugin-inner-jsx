import * as React from 'react';

import Component2, { Component as Component3 } from 'library';

import Component from './Component';

interface ButtonProps {}

const hoc = SuperComponent => {
  const Button: React.SFC<ButtonProps> = () => {
    const Component5 = () => <div />;

    return (
      <div>
        <SuperComponent />
        <Component2>
          <Component3 />
          <Component>
            <Component5 />
            <Component4 />
          </Component>
        </Component2>
      </div>
    );
  };

  return Button;
};

const Component4 = () => <div />;
