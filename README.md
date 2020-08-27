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
