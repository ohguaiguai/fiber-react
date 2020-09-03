## fiber

```js
interface Fiber {
  tag: string; // 元素类型
  type: string; //具体的元素类型
  props: object; //新的属性对象
  stateNode: Element | null; //
  return: Fiber; //父Fiber
  alternate: Fiber; // 指向上上次的fiber
  sibling: Fiber; // 兄弟fiber
  effectTag: string; //副作用标识， render阶段会收集副作用， 增加，删除，更新
  nextEffect: Fiber; // 下一个有副作用的Fiber
}
```

#### 双缓冲机制

从第二次以及之后的更新开始，用到的根 fiber 树都是上上次创建好的，类似这样的顺序： A->B->A->B->A...

这样的话在本次更新的协调阶段就可以复用之前已经创建好的子 fiber 了, 无需再闯创建一个新的 newFiber

```js
if (oldFiber.alternate) {
  // 如果有上上次的fiber就拿过来使用
  newFiber = oldFiber.alternate;
  newFiber.props = newChild.props;
  newFiber.alternate = oldFiber;
  newFiber.effectTag = UPDATE;
  newFiber.updateQueue = oldFiber.updateQueue || new UpdateQueue();
  newFiber.nextEffect = null;
}
```

#### 总结

fiber 就是利用浏览器的 api requestIdleCallback 在浏览器渲染的一帧的空闲时间里来渲染我们的 dom。

fiber 执行分为两个阶段：

1. 协调阶段: 可以认为是 Diff 阶段, 这个阶段会找出所有节点变更，例如节点新增、删除、属性变更等等, 这些变更 React 称之为副作用(Effect)， 此阶段可以中断

- 这个阶段有两个任务

  1.  根据虚拟 DOM 生成 fiber 树, 按照广度优先遍历

  2.  收集 effect list, 按照后序遍历

2. 提交阶段: 将上一个阶段计算出来的需要处理的副作用(Effects)一次性执行了。

- 这个阶段必须同步执行，不能被打断， 否则会出现不连续的 UI

##### 函数组件的执行流程是什么？

1. 全局上有两个变量 workInProgressFiber 和 hookIndex, 前者用来保存当前正在执行中的 fiber, 后者是 hook 的索引
2. 初次渲染给 workInProgressFiber 赋值为当前正在执行中的 fiber， 挂了一个 hooks 数组，初始化 hookIndex 为 0, 然后执行函数拿到最终返回值，执行函数的过程中会执行 useReducer(useState 本质上也是 useReducer)

```js
function updateFunctionComponent(currentFiber) {
  workInProgressFiber = currentFiber;
  hookIndex = 0;
  workInProgressFiber.hooks = []; // 给当前的渲染fiber创建一个hooks
  // currentFiber.type就是函数名， 执行这个函数得到返回的结果
  const newChildren = [currentFiber.type(currentFiber.props)];
  reconcileChildren(currentFiber, newChildren);
}
```

3. 执行 useReducer, 第一次渲染根据每一个 useState 生成一个 hook 对象，这个对象包含 state 和一个更新队列。 下一次更新就执行更新队列返回最新 state

```js
const [action, changeAction] = useState('');
```

```js
export function useReducer(reducer, initialValue) {
  // 取上一次的hook
  let oldHook =
    workInProgressFiber.alternate &&
    workInProgressFiber.alternate.hooks &&
    workInProgressFiber.alternate.hooks[hookIndex]; // 可能有多个hook
  let newHook = oldHook;
  if (oldHook) {
    newHook.state = oldHook.updateQueue.forceUpdate(oldHook.state);
  } else {
    newHook = {
      state: initialValue,
      updateQueue: new UpdateQueue(),
    };
  }
  const dispatch = (action) => {
    // 这个action在useState中就是我们传入的新的state, 先入队，再调度执行
    newHook.updateQueue.enqueueUpdate(
      new Update(reducer ? reducer(newHook.state, action) : action)
    );
    scheduleRoot();
  };
  workInProgressFiber.hooks[hookIndex++] = newHook;
  return [newHook.state, dispatch];
}
```

#### useState 如何保存状态?

全局有一个 hooks 数组保存所有的 hook, 每一个 hook 都有一个 hook 对象， 这个对象保存了 state
