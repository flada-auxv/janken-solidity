import React from 'react';
import { DrizzleContext } from "drizzle-react";
import AppMain from './AppMain';

export default class Layout extends React.Component {
  render() {
    return (
      <DrizzleContext.Consumer>
        {drizzleContext => {
          const { drizzle, drizzleState, initialized } = drizzleContext;

          if (!initialized) return 'loading...';

          return (
            <AppMain drizzle={drizzle} drizzleState={drizzleState} />
          )
        }}
      </DrizzleContext.Consumer>
    )
  }
}
