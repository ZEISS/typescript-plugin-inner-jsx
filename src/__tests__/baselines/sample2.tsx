import * as React from "react";

import Component2, { Component as Component3 } from "library";

import Component from "./Component";

interface ButtonProps {}

class Button extends React.Component {
  render() {
    const Component5 = () => <div />;
    return (
      <div>
        <Component2>
          <Component3 />
          <Component>
            <Component5 />
            <Component4 />
          </Component>
        </Component2>
      </div>
    );
  }
}

const Component4 = () => <div />;
