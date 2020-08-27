import { setProps } from './utils';
import {
  ELEMENT_TEXT,
  TAG_ROOT,
  TAG_HOST,
  TAG_TEXT,
  PLACEMENT,
  DELETION,
  UPDATE,
  TAG_CLASS,
  TAG_FUNCTION,
} from './constants';
import { Update, UpdateQueue } from './updateQueue';

let workInProgressRoot = null; //正在渲染中的根Fiber
let nextUnitOfWork = null; //下一个工作单元
let currentRoot = null; // 保存当前渲染成功的树，下一次更新时使用
let deletions = []; // 删除的节点并不放在effect list中，需要单独记录并执行

let workInProgressFiber = null; // 正在工作中的fiber
let hookIndex = 0; // hooks 索引

export function scheduleRoot(rootFiber) {
  // debugger;
  // 第二次更新以及之后的更新， 使用上上次的, 这样workInProgressRoot就不用每次都开辟新的内存空间
  if (currentRoot && currentRoot.alternate) {
    workInProgressRoot = currentRoot.alternate; // 拿到初次渲染时的fiber树
    workInProgressRoot.alternate = currentRoot;
    if (rootFiber) {
      workInProgressRoot.props = rootFiber.props;
    }
  }
  // 第一次更新
  else if (currentRoot) {
    if (rootFiber) {
      rootFiber.alternate = currentRoot; // 把当前根fiber的alternate指向上一个根fiber
      workInProgressRoot = rootFiber; // 把正在渲染中的树指向当前根fiber
    } else {
      workInProgressRoot = { ...currentRoot, alternate: currentRoot };
      // console.log('workInProgressRoot', workInProgressRoot);
    }
  } else {
    // 初次渲染
    //把当前树设置为nextUnitOfWork开始进行调度
    workInProgressRoot = rootFiber;
  }
  workInProgressRoot.firstEffect = workInProgressRoot.lastEffect = workInProgressRoot.nextEffect = null;
  nextUnitOfWork = workInProgressRoot;
}

function commitRoot() {
  deletions.forEach(commitWork); // 执行effect list之前把该删除的元素删除
  let currentFiber = workInProgressRoot.firstEffect;
  while (currentFiber) {
    commitWork(currentFiber);
    currentFiber = currentFiber.nextEffect;
  }
  deletions.length = 0;
  workInProgressRoot.firstEffect = workInProgressRoot.lastEffect = null; //清除effect list
  currentRoot = workInProgressRoot; // 更新currentRoot
  // console.log('currentRoot', currentRoot);
  workInProgressRoot = null; // 完成之后清空
}

function commitWork(currentFiber) {
  if (!currentFiber) {
    return;
  }
  let returnFiber = currentFiber.return; //先获取父Fiber
  while (
    returnFiber.tag !== TAG_HOST &&
    returnFiber.tag !== TAG_ROOT &&
    returnFiber.tag !== TAG_TEXT
  ) {
    //如果不是DOM节点就一直向上找,比如ClassCounter
    returnFiber = returnFiber.return;
  }
  const domReturn = returnFiber.stateNode; //获取父的DOM节点
  if (currentFiber.effectTag === PLACEMENT && currentFiber.stateNode != null) {
    //如果是新增DOM节点
    let nextFiber = currentFiber;
    // 如果是类组件 必须向下找到一个DOM节点 比如Class Counter
    while (nextFiber.tag !== TAG_HOST && nextFiber.tag !== TAG_TEXT) {
      nextFiber = nextFiber.child;
    }
    domReturn.appendChild(nextFiber.stateNode);
  } else if (currentFiber.effectTag === DELETION) {
    commitDeletion(currentFiber, domReturn);
  } else if (currentFiber.effectTag === UPDATE) {
    if (currentFiber.type === ELEMENT_TEXT) {
      if (currentFiber.alternate.props.text !== currentFiber.props.text) {
        currentFiber.stateNode.textContent = currentFiber.props.text;
      }
    } else {
      updateDOM(
        currentFiber.stateNode,
        currentFiber.alternate.props,
        currentFiber.props
      );
    }
  }
  currentFiber.effectTag = null; // 处理副作用之后就置为null
}

function commitDeletion(currentFiber, domReturn) {
  if (currentFiber.tag === TAG_HOST || currentFiber.tag === TAG_TEXT) {
    domReturn.removeChild(currentFiber.stateNode);
  } else {
    commitDeletion(currentFiber.child, domReturn);
  }
}

function performUnitOfWork(currentFiber) {
  beginWork(currentFiber); // 开始渲染前的Fiber,就是把子元素变成子fiber

  if (currentFiber.child) {
    //如果有子节点就返回第一个子节点， 接着循环这个子节点创建fiber树
    return currentFiber.child;
  }

  while (currentFiber) {
    //如果没有子节点说明当前节点已经完成了渲染工作
    completeUnitOfWork(currentFiber); //可以结束此fiber的渲染了
    if (currentFiber.sibling) {
      //如果它有弟弟就返回弟弟
      return currentFiber.sibling;
    }
    currentFiber = currentFiber.return; //如果没有弟弟让爸爸完成，然后找叔叔
  }
}

// 1. 创建真实DOM元素
// 2. 创建子fiber
function beginWork(currentFiber) {
  const tag = currentFiber.tag;
  switch (tag) {
    case TAG_ROOT:
      //如果是根节点 不需要创建真实DOM元素
      updateHostRoot(currentFiber);
      break;
    case TAG_TEXT:
      //如果是原生文本节点
      updateHostText(currentFiber);
      break;
    case TAG_HOST:
      //如果是原生DOM节点
      updateHostComponent(currentFiber);
      break;
    case TAG_CLASS:
      updateClassComponent(currentFiber);
      break;
    case TAG_FUNCTION:
      updateFunctionComponent(currentFiber);
      break;
    default:
      break;
  }
}

function updateFunctionComponent(currentFiber) {
  workInProgressFiber = currentFiber;
  hookIndex = 0;
  workInProgressFiber.hooks = [];
  const newChildren = [currentFiber.type(currentFiber.props)];
  reconcileChildren(currentFiber, newChildren);
}

function updateClassComponent(currentFiber) {
  // console.log('updateClassComponent', currentFiber);
  if (!currentFiber.stateNode) {
    // 类组件的stateNode 为组件的实例
    // currentFiber.type 就是组件名
    currentFiber.stateNode = new currentFiber.type(currentFiber.props); // new 一个类组件的实例
    currentFiber.stateNode.internalFiber = currentFiber; // 双向指针
    currentFiber.updateQueue = new UpdateQueue(); // 初次渲染类组件时创建一个新的更新队列， 下次更新调用setState时更新这个队列
  }
  currentFiber.stateNode.state = currentFiber.updateQueue.forceUpdate(
    currentFiber.stateNode.state
  );
  let newElement = currentFiber.stateNode.render(); // 执行类组件的render方法
  // console.log(currentFiber.stateNode.state);
  const newChildren = [newElement];
  reconcileChildren(currentFiber, newChildren);
}

function updateHostRoot(currentFiber) {
  //如果是根节点
  const newChildren = currentFiber.props.children; // #root 下的子节点
  reconcileChildren(currentFiber, newChildren);
}
function updateHostText(currentFiber) {
  // 如果此fiber没有创建DOM节点
  if (!currentFiber.stateNode) {
    currentFiber.stateNode = createDOM(currentFiber); //先创建真实的DOM节点
  }
}
function updateHostComponent(currentFiber) {
  //如果是原生DOM节点
  if (!currentFiber.stateNode) {
    currentFiber.stateNode = createDOM(currentFiber); //先创建真实的DOM节点
  }
  const newChildren = currentFiber.props.children;
  reconcileChildren(currentFiber, newChildren);
}
function createDOM(currentFiber) {
  if (currentFiber.type === ELEMENT_TEXT) {
    return document.createTextNode(currentFiber.props.text);
  }
  const stateNode = document.createElement(currentFiber.type);
  updateDOM(stateNode, {}, currentFiber.props);
  return stateNode;
}

// 根据虚拟dom建立fiber树
function reconcileChildren(currentFiber, newChildren) {
  let newChildIndex = 0; //新虚拟DOM数组中的索引
  // 如果不是第一次渲染
  let oldFiber = currentFiber.alternate && currentFiber.alternate.child; // 取到上一个已经渲染的fiber树的第一个子fiber
  if (oldFiber) {
    oldFiber.firstEffect = oldFiber.lastEffect = oldFiber.nextEffect = null;
  }
  let prevSibling; // 前一个fiber

  // 这个while只是循环当前节点的子节点, 并不是所有的节点
  while (newChildIndex < newChildren.length || oldFiber) {
    const newChild = newChildren[newChildIndex];
    const sameType = oldFiber && newChild && oldFiber.type === newChild.type;
    let tag, newFiber;

    if (newChild && typeof newChild.type === 'function') {
      tag = TAG_FUNCTION;
    } else if (
      newChild &&
      typeof newChild.type === 'function' &&
      newChild.type.prototype.isReactComponent
    ) {
      tag = TAG_CLASS; //类组件
    } else if (newChild && newChild.type === ELEMENT_TEXT) {
      tag = TAG_TEXT; //文本
    } else if (newChild && typeof newChild.type === 'string') {
      tag = TAG_HOST; //原生DOM组件
    }

    // 说明老的fiber和新的虚拟DOM类型一样，可以复用老的DOM节点，更新即可
    if (sameType) {
      if (oldFiber.alternate) {
        // 如果有上上次的fiber就拿过来使用
        newFiber = oldFiber.alternate;
        newFiber.props = newChild.props;
        newFiber.alternate = oldFiber;
        newFiber.effectTag = UPDATE;
        newFiber.updateQueue = oldFiber.updateQueue || new UpdateQueue();
        newFiber.nextEffect = null;
      } else {
        newFiber = {
          tag: oldFiber.tag, //原生DOM组件
          type: oldFiber.type, //具体的元素类型
          props: newChild.props, //新的属性对象
          stateNode: oldFiber.stateNode, //stateNode肯定是空的
          return: currentFiber, //父Fiber
          updateQueue: oldFiber.updateQueue || new UpdateQueue(), // 第一次更新使用上一次的更新后的队列
          alternate: oldFiber, // 新的A1 fiber 指向 老的 A1 fiber
          effectTag: UPDATE, //副作用标识， render阶段会收集副作用， 增加，删除，更新
          nextEffect: null, // effect list也是一个单链表, 顺序和完成顺序一样，但是节点可能只放那些有改动的
        };
      }
    } else {
      // newChild可能是null,null不需要创建新fiber
      if (newChild) {
        newFiber = {
          tag, //原生DOM组件
          type: newChild.type, //具体的元素类型
          props: newChild.props, //新的属性对象
          stateNode: null, //stateNode肯定是空的
          return: currentFiber, //父Fiber
          effectTag: PLACEMENT, //副作用标识， render阶段会收集副作用， 增加，删除，更新
          nextEffect: null, // effect list也是一个单链表, 顺序和完成顺序一样，但是节点可能只放那些有改动的
        };
      }

      // dom类型不一致， 删除老的
      if (oldFiber) {
        oldFiber.effectTag = DELETION;
        deletions.push(oldFiber);
      }
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling; // 指针后移
    }

    if (newFiber) {
      // 说明是第一个fiber
      if (newChildIndex === 0) {
        currentFiber.child = newFiber; //第一个子节点挂到父节点的child属性上
      } else {
        prevSibling.sibling = newFiber; // 不是第一个子节点，那就放在上一个子节点之后
      }
    }
    prevSibling = newFiber; //然后newFiber变成了上一个哥哥了
    newChildIndex++;
  }
}

function updateDOM(stateNode, oldProps, newProps) {
  if (stateNode && stateNode.setAttribute) {
    setProps(stateNode, oldProps, newProps);
  }
}

// 在完成的时候收集有副作用的fiber
// 第一个完成的是A1(TEXT)
// 一般流程：
// 1. 把自己的儿子挂在自己的父亲上，这个过程就是主要是修改父亲的lastEffect指向， 如果父亲的lastEffect有值那么就修改其returnFiber.lastEffect.nextEffect
// 2. 把自己挂在父亲的身上，这个过程依然是修改父亲的lastEffect指向， 如果父亲的lastEffect有值那么就修改其returnFiber.lastEffect.nextEffect
function completeUnitOfWork(currentFiber) {
  const returnFiber = currentFiber.return;
  // 表示不是根fiber
  if (returnFiber) {
    /* 把自己下面的儿子的effect链挂到父fiber身上, 主要就是更新lastEffect */
    // 根fiber的firstEffect总是指向第一个完成的子fiber， 赋值之后就不会再变了
    if (!returnFiber.firstEffect) {
      returnFiber.firstEffect = currentFiber.firstEffect; // 让父的firstEffect指向自己的firstEffect
    }

    if (currentFiber.lastEffect) {
      if (returnFiber.lastEffect) {
        returnFiber.lastEffect.nextEffect = currentFiber.firstEffect;
      }
      //
      returnFiber.lastEffect = currentFiber.lastEffect;
    }

    /* 把自己挂在父fiber上 */
    const effectTag = currentFiber.effectTag;
    // 有副作用
    if (effectTag) {
      if (returnFiber.lastEffect) {
        returnFiber.lastEffect.nextEffect = currentFiber;
      } else {
        returnFiber.firstEffect = currentFiber;
      }
      returnFiber.lastEffect = currentFiber;
    }
  }
}

function workLoop(deadline) {
  while (nextUnitOfWork && deadline.timeRemaining() > 1) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork); //执行一个任务并返回下一个任务
  }
  //如果没有下一个执行单元了，并且当前渲染树存在，则进行提交阶段
  if (!nextUnitOfWork && workInProgressRoot) {
    commitRoot();
  }
  requestIdleCallback(workLoop); // 源码是每一帧都运行
}

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
    newHook.updateQueue.enqueueUpdate(
      new Update(reducer ? reducer(newHook.state, action) : action)
    );
    scheduleRoot();
  };
  workInProgressFiber.hooks[hookIndex++] = newHook;
  return [newHook.state, dispatch];
}
export function useState(initState) {
  return useReducer(null, initState);
}

//开始在空闲时间执行workLoop
requestIdleCallback(workLoop);
