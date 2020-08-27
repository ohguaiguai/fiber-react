import { ELEMENT_TEXT } from './constants';
import { UpdateQueue, Update } from './updateQueue';
import { scheduleRoot, useReducer, useState } from './scheduler';
function createElement(type, config, ...children) {
  delete config.__self;
  delete config.__source; // 表示这个元素是在哪行哪列哪个文件生成的
  return {
    type,
    props: {
      ...config,
      // 做一个兼容处理，如果是React元素的话则返回自己，如果是字符串，就包装成一个文本节点
      children: children.map((child) => {
        return typeof child === 'object'
          ? child
          : {
              type: ELEMENT_TEXT,
              props: { text: child, children: [] },
            };
      }),
    },
  };
}

class Component {
  constructor(props) {
    this.props = props;
  }
  setState(payload) {
    let update = new Update(payload);
    this.internalFiber.updateQueue.enqueueUpdate(update);
    scheduleRoot();
  }
}
Component.prototype.isReactComponent = true; // 表示类组件

let React = {
  createElement,
  Component,
  useState,
  useReducer,
};
export default React;
