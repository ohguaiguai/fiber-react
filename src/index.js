import React from './react';
import ReactDOM from './react-dom';

function reducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return { count: state.count + 1 };
    default:
      return state;
  }
}
// useState是一个语法糖，基于useReducer实现
function FunctionCounter() {
  const [countState, dispatch] = React.useReducer(reducer, { count: 0 });
  const [numberState, setNumberState] = React.useState({ number: 0 });
  return (
    <div id='container'>
      <h1>Count:{countState.count}</h1>
      <h1>Count:{numberState.number}</h1>
      <button onClick={() => dispatch({ type: 'ADD' })}>useReducer 加1</button>
      <button
        onClick={() => setNumberState({ number: numberState.number + 1 })}
      >
        useState 加1
      </button>
    </div>
  );
}
ReactDOM.render(<FunctionCounter />, document.getElementById('root'));
