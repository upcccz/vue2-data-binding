const arrayProto = Array.prototype; // 源

const arrayMethods = Object.create(arrayProto); // 继承 Array 原型
const arrayKeys = Object.getOwnPropertyNames(arrayMethods); // 取出数组的方法集合

[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
].forEach((method) => {
  const original = arrayProto[method];
  Object.defineProperty(arrayMethods, method, {
    value: function(...args) {
      const result = original.apply(this, args);
      const ob = this.__ob__;
      let inserted;
      switch (method) {
        case 'push':
        case 'unshift':
          inserted = args;
        case 'splice':
          inserted = args.slice(2)
          break;
      }
      if (inserted) ob.observerArray(inserted);
      ob.dep.notify();
      return result;
    },
    enumerable: false,
    writable: true,
    configurable: true
  })
})

const hasProto = '__proto__' in {}; // 检测 __proto__ 是否可用

function def(obj, key, val, enumerable) {
  if (!obj || typeof obj !== 'object') {
    // 如果数据不存在 或者不是一个对象 则直接return不监听
    return;
  }
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true,
  })
}

function protoAugment(target, src, keys) {
  target.__proto__ = src;
}

function copyAugment(target, src, keys) { // 有的浏览器不支持 __proto__，那么直接将方法挂载在这个数组对象上
  target.__proto__ = src;
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];
    def(target, keys, src[key])
  }
}

class Observer {
  constructor(value) {
    this.value = value;

    // 监听对象的时候，在getter时收集依赖，在 setter时触发依赖。
    // 监听数组的时候，也在getter时收集依赖，但是需要在拦截器中触发依赖，因为数组的方法能够改变数组的结构。
    
    // 用来保存数组的依赖，因为需要满足 getter的时候能够访问到，拦截器中也可以访问到
    // 所以将依赖保存在Observe实例上，因为在 getter中能访问到 Observe实例，拦截器中也访问的到
    this.dep = new Dep();

    def(value, '__ob__', this); // 为响应式数据都注册__ob__ 属性，使其通过自身能拿到 Observe 实例，也能标注自身是一个响应式数据

    if (Array.isArray(value)) {
      // 增强数组，拦截能够修改数组的方法
      const augment = hasProto ? protoAugment : copyAugment;
      augment(value, arrayMethods, arrayKeys);
      this.observerArray(value);
    } else {
      this.walk(value); // 监听对象
    }
  }

  walk(obj) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i], obj[keys[i]]);
    }
  }

  observerArray(items) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

function defineReactive(data, key, val) {
  let childOb = observe(val);
  let dep = new Dep();
  Object.defineProperty(data, key, {
    enumerable: true,
    configurable: true,
    get() {
      dep.depend();
      
      if (childOb) {
        childOb.dep.depend();
      }
      // 收集 Array 的依赖
      return val;
    },
    set(newVal) {
      if (val === newVal) {
        return
      }
      val = newVal;
      childOb = observe(newVal)
      dep.notify();
    }
  })
}

function observe(value) {
  if (typeof value !== 'object') {
    return;
  }

  let ob;
  if (value.hasOwnProperty('__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__;
  } else {
    ob = new Observer(value);
  }
  return ob;
}

// 发布-订阅
class Dep {
  constructor() {
    // 订阅的数组
    this.subs = [];
  }

  addSub(sub) {
    this.subs.push(sub)
  }

  removeSub(sub) {
    remove(this.subs, sub)
  }

  depend() { // 订阅
    if (window.target) {
      this.addSub(window.target);
    }
  }

  notify() { // 发布
    this.subs.forEach(sub => {
      sub.update();
    })
  }
}

function remove(arr, item) {
  if (arr.length) {
    const index = arr.indexOf(item);
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}