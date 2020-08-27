## fiber

```js
interface Fiber {
  tag: string; // 元素类型
  type: string; //具体的元素类型
  props: object; //新的属性对象
  stateNode: HTMLElement; //
  return: Fiber; //父Fiber
  sibling: Fiber; // 兄弟Fiber
  effectTag: string; //副作用标识， render阶段会收集副作用， 增加，删除，更新
  nextEffect: Fiber; // 下一个有副作用的Fiber
}
```

双缓冲机制
A->B->A->B->A。。。。
