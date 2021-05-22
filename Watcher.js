class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm;
    this.getter = parsePath(expr);
    this.cb = cb;
    this.value = this.get();
  }

  get() {
    window.target = this;
    // 触发getter就会访问被绑定属性，就会触发这个“数据”的get，就会触发dep.depend()，就会自己（当前watcher实例）添加到这个“数据”的Dep中
    let value = this.getter.call(this.vm, this.vm);
    window.target = null;
    return value
  }

  update() {
    const oldValue = this.value;
    this.value = this.get();
    // this.cb(this.vm, this.value, oldValue);
    this.cb(this.value, oldValue);
  }
}

const bailRe = /[^\w.$]/;
function parsePath(path) {
  // 排除无效path
  if (bailRe.test(path)) {
    return;
  }

  const segments = path.split('.');
  return function(obj) {
    for (let i = 0, l = segments.length; i < l; i++) {
      if (!obj) return;
      obj = obj[segments[i]]
    }
    return obj;
  }
}