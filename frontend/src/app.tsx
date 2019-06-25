import React from 'react';
import { Drizzle } from 'drizzle';
import { DrizzleContext } from 'drizzle-react';

import Layout from './components/Layout';
import drizzleOptions from './drizzleOptions';

const drizzle = new Drizzle(drizzleOptions);

export default class App extends React.Component {
  render() {
    return (
      <DrizzleContext.Provider drizzle={drizzle}>
        <Layout />
      </DrizzleContext.Provider>
    )
  }
}
