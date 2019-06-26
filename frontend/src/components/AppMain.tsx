import React from 'react';

interface Props {
  drizzle: any;
  drizzleState: any;
}
interface State {
  dataKey: any;
}

export default class AppMain extends React.Component<Props, State> {
  state = { dataKey: null };

  async componentDidMount() {
    const { drizzle } = this.props;
    const { Janken } = drizzle.contracts;

    var dataKey = Janken.methods['gameId'].cacheCall();
    this.setState({ dataKey });
  }

  render() {
    const { Janken } = this.props.drizzleState.contracts;
    const gameId = Janken.gameId[this.state.dataKey];

    return (
      <div>
        <p>hi: {gameId && gameId.value}</p>
      </div>
    )
  }
}
