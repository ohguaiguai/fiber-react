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
