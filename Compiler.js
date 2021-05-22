class Compiler {
  constructor(el, vm) {
    // vm是传过来的vue实例 初始化数据 方便函数中调用

    // 如果el是一个元素直接赋值给this.el 如果是一个字符串'#app' 则使用dom方法自己去取。
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    // 这里的vm就是 Vue.js中的this  拥有 $el 和 $data 属性的。
    this.vm = vm;
    if (this.el) {
      // 如果这个元素存在（使用dom方法能够获取到）则开始编译。

      // 1.先把真实的dom即this.el 存在fragment中 （文档节点，可以使用dom的方法，但是不会影响页面）
      let fragment = this.node2fragment(this.el);

      // 此时的fragment 就相当于是el的副本 只不过不存在于真实dom中 存在内存中 不用担心过多操作影响性能。

      // 2.编译fragment : 就是从中提取 插值表达式 {{}} 和 v-xx指令 换成数据
      this.compile(fragment)
      // 3.将编译好之后的fragment塞到页面中区，替换#app那个div 
      // 经过第二步 fragment已经编译好了 将他塞回页面
      this.el.appendChild(fragment)
    }
  }

  // 定义一个方法判断传进来的node是否是一个元素
  isElementNode(node) {
    return node.nodeType === 1;
  }
  // 定义一个方法判断是不是一个指令
  isDirective(name) {
    return name.includes('v-')
  }

  // 将真实dom取出存在fragment中
  node2fragment(el) {
    // 创建一个文档碎片 
    let fragment = document.createDocumentFragment();

    let firstChild;
    // 定义个变量firstChild，每次都将元素的第一个节点赋值给firstChild
    // 当调用fragment.appendChild()时，el中的第一个节点就会从el中**移除**然后添加到文档碎片中
    // 当el所有的节点都移除是，el.firstChild就是null 那么firstChild也就是null 循环结束
    // 这样就所有的节点中el中移入到了fragment中 然后将文档碎片返回。
    while (firstChild = el.firstChild) {
      fragment.appendChild(firstChild);
    }
    return fragment;
  }

  // 就是从中提取 插值表达式 {{}} 和 v-xx指令 换成数据 
  compile(fragment) {
    // 先获取所有的子节点
    let childNodes = fragment.childNodes;

    // 遍历节点集合，针对性编译
    Array.from(childNodes).forEach(node => {
      if (this.isElementNode(node)) { // 如果是元素节点
        // 编译元素
        this.compileElement(node)
        // 并且如果是元素节点则还需要递归 目的是为了拿到所有的插值表达式及指令
        this.compile(node)

      } else { // 文本节点
        // 编译文本
        this.compileText(node)
      }
    })
  }

  // 编译元素 => 取出指令即元素的v-xx 属性。
  compileElement(node) {
    // 取出元素身上的所有属性 
    let attrs = node.attributes;
    // 编译属性 找到v-xx attr.name拿到属性名 attr.value拿到属性值
    Array.from(attrs).forEach(attr => {
      if (this.isDirective(attr.name)) {
        //  如果是一个指令 取到对应指令的值渲染成数据放到节点中
        //  需要 属性值、数据、节点
        let val = attr.value; // v-model="message" 中的 message
        // 解构赋值 v-model 取到model = type
        let [, type] = attr.name.split('-'); // v-model="message"中的 model
        //  通过vm就能取到实例上的data
        CompileUtil[type](val, this.vm, node)
      }
    });
  }

  // 编译文本 => 取出插值表达式
  compileText(node) {
    // 取出节点中的文本
    let txt = node.textContent;

    // 定义正则取出表达式
    let reg = /\{\{([^}]+)\}\}/g;

    if (reg.test(txt)) {
      // 如果为true则说明有插值表达式
      // 取出表达式 渲染成数据 插到节点中
      //  需要 表达式、数据、节点

      //  通过vm就能取到实例上的data  将整个文本传过去 在函数里面进行表达式的抽取
      CompileUtil['text'](txt, this.vm, node)
    }
  }
}
//  定义一个专门用来编译的工具
CompileUtil = {
  // 定义一个方法 从vm.$data中取值 
  getVal(vm, expr) {
    // message.a.b 转换成 vm.$data.message.a.b
    // vm.$data[message.a.b] 很明显是错误的写法 取不到 所以需要借助reduce
    expr = expr.split('.');
    
    return expr.reduce((prev, next) => {
      const exprVal = next;
      let exprMatch, key, index;
      if (exprMatch = exprVal.match(/[\d]/)) { // 是读取数组
        key = exprVal.split('[')[0]
        index = exprVal.match(/[\d]/)[0]
      }
      if (key) {
        return prev[key][index]
      }
      return prev[next]
    }, vm.$data)
  },
  getTxtVal(vm, expr) {
    return expr.replace(/\{\{([^}]+)\}\}/g, (...arg) => {
      // 这里的arg[1] 就是 message / message.a
      return this.getVal(vm, arg[1].trim())
    })
  },
  setVal(vm, expr, newVal) {
    expr = expr.split('.')
    return expr.reduce((prev, next, cIndex) => {
      if (cIndex === expr.length - 1) {
        // 循坏到最后的时候 message => message.a => message.a.b 赋新值
        return prev[next] = newVal;
      }
      return prev[next]
    }, vm.$data)
  },
  text(expr, vm, node) { // 插值文本处理
    // 取出更新函数
    let updateFn = this.updater['txtUpdater'];

    // 更新
    // 通过正则取出真正的表达式 {{ message.a }} == vm.$data.message.a
    // 此时的value就是 vm.$data.message / vm.$data.message.a
    let value = this.getTxtVal(vm, expr)

    // 这里应该加一个监控 数据变化了 重新编译模板 **数据=>视图**
    expr.replace(/\{\{([^}]+)\}\}/g, (...arg) => {
      // 这里的arg[1] 就是 message / message.a
      new Watcher(vm, arg[1].trim(), (newVal) => {
        // 如果数据变化了 文本节点需要重新获取新的数据 然后更新dom
        // 回调会在Watcher.update()调用时执行 ， 什么时候会调用呢
        // 数据更新的时候 应该调用 就是在劫持数据映射set哪里
        updateFn && updateFn(node, newVal)
      })
    })

    updateFn && updateFn(node, value)
  },
  model(expr, vm, node) { // v-model处理
    // 取出更新函数
    let updateFn = this.updater['modelUpdater'];

    // 这里应该加一个监控 数据变化了 重新编译模板 **数据=>视图**
    new Watcher(vm, expr, (newVal) => {
      // 回调会在Watcher.update()调用时执行 ， 什么时候会调用呢
      // 数据更新的时候 应该调用 就是在劫持数据映射set那里
      updateFn && updateFn(node, newVal)
    })

    // 更新 : vm.$data[expr] == vm.$data.message即数据
    // updateFn && updateFn(node, vm.$data[expr])
    // 因为这个expr 很可能是 message.a.b 所以需要在定义一个专门取值的函数
    updateFn && updateFn(node, this.getVal(vm, expr))

    // 处理 v-model时 监听node的input事件 **视图改变=>数据更新**
    node.addEventListener('input', (e) => {
      // 因为可能v-model 绑定的是一个深层属性 所以同样要去reduce 修改 最深层属性的值
      this.setVal(vm, expr, e.target.value)
    })

  },
  updater: {
    txtUpdater(node, value) { // 编译更新插值表达式
      // 传入一个节点 一个新值，在fragment中更新这个新值 最后渲染到页面上去
      // 作用：即可以初始时将 message 替换成 'hello world' 也可以将新的message 替换 旧的message
      node.textContent = value;
    },
    modelUpdater(node, value) { // 编译更新v-model
      // v-model 即绑定的是表单元素的value属性
      // 传入一个节点（表单元素） 一个新值，更新表单元素的value
      node.value = value;
    }
  }
}