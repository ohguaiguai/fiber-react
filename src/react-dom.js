import { TAG_ROOT } from './constants';
import { scheduleRoot } from './scheduler';
function render(element, container) {
  let rootFiber = {
    tag: TAG_ROOT, // 每个fiber会有一个tag标识此元素的类型,
    stateNode: container, // 指向真实DOM元素 根对应的就是 #root
    props: {
      children: [element], // props.children是一个数组，存放的是React元素，也就是虚拟dom
    },
  };
  scheduleRoot(rootFiber); // 开始调度
}

export default {
  render,
};
