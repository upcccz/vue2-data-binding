class Vue {
  constructor(options) {
    // 将数据缓存在vue实例属性上，方便实例中的函数能够使用this.xx访问到
    this.$el = options.el;
    this.$data = options.data;
    if (this.$el) {
      // 数据劫持 监听data这个对象 监听其中的属性 映射为get 和 set 
      new Observer(this.$data)

      // 代理数据 this.$data.message => this.message
      this.proxyData(this.$data)

      // 如果$el存在 就进行编译 （编译需要数据和元素）
      // 这里第二个参数把this传过去 那边要什么直接通过this取。
      new Compiler(this.$el, this);
    }
  }
  proxyData(data) {
    Object.keys(data).forEach(key => {
      Object.defineProperty(this, key, {
        get() { // this.message => this.$data.message
          return data[key]
        },
        set(newVal) {
          // this.$data.message = '新值'
          data[key] = newVal;
        }
      })
    })
  }
}