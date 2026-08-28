# DSH Balance Phoebe — 鸣潮菲比余额挂件

基于 DeepSeek Harness (DSH) 的鸣潮菲比主题余额挂件插件，灵感来自 [dsh-whale-widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)。

---

## 图片获取全流程

### 1. 豆包提示词生成

使用豆包（字节跳动 AI）生成鸣潮菲比角色图片。

- 编写提示词描述菲比形象（服饰、姿态、背景等）
- 生成满意的图片后保存到本地

### 2. Photopea 在线抠图（移除背景）

操作步骤：

1. 打开 https://www.photopea.com/
2. 导入图片：拖拽步骤 1 保存的图片
3. 菜单栏点击 `选择` → `主体`——自动识别人物区域
4. 反选并删除背景：`Shift+Ctrl+I`（反选）→ `Ctrl+X`（剪切删除背景）
5. 导出透明 PNG：`文件` → `另存为` → 选择 `PNG` 格式 → 保存


## 安装

```powershell
# 在仓库根目录执行
dsh plugin --profile web add "github:dsh-balance-phoebe"

# 重启 dsh web
dsh web
```

---

## 开发计划

- [x] 角色图片获取与抠图
- [ ] DSH 插件骨架搭建
- [ ] 余额查询路由
- [ ] 页面挂件 UI
- [ ] 按压 Q 弹效果
- [ ] 气泡与台词系统
- [ ] 音效系统