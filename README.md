# 全球媒体舆情图谱

这是一个基于 React、D3 和完整 Excel 数据构建的多层级媒体舆情可视分析项目。

## 本地运行

```bash
npm install
npm run data:build
npm run dev:local
```

打开 `http://localhost:3000/`。

## 更新数据

将新的 Excel 文件放在项目父目录并保持当前文件名，然后运行：

```bash
npm run data:build
```

原始 Excel 不会被修改。生成的数据位于 `public/data/`。

## 验证

```bash
npm run test:data
npm run build
```

数据测试会检查全部 5,543 条记录、114 个国家、重复表头保留以及国家汇总对账。
