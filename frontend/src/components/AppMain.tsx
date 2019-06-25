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

  render() {
    const { Janken } = this.props.drizzleState.contracts;
    const game = Janken.games[1];
    debugger
    console.log('games', Janken.games);
    console.log('game', game);

    return (
      <div>
        <p>{game}</p>
      </div>
    )
  }
}
