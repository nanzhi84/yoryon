# 页面宽度与要点

目标：全站内容列与文章正文同宽；description 作为一句话要点，明确 Markdown 要点优先。
数据流：已授权 ContentDetail → ArticleSummary（只解析当前 DTO 正文）或 authored summary → 卡片；权限仍由既有接口裁剪，不读取私有正文生成摘要。正文搜索节点不包含简介，保持已有定位顺序。
外壳708px含左右24px内距，内容最大660px；各页面继承，不另设较窄页面列。
失败边界：空简介不占位；代码围栏或引用内的要点标题不识别；作者要点优先避免重复；付费公开预览与私有全文各自处理当前正文。
环境：http://localhost:3016，API http://127.0.0.1:4115；隔离DB yoryon_page_redesign_20261013 和 /tmp/yoryon-page-redesign-m0NxxV/storage；沿用用户要求保留的本地长文示例，无生产数据写入。
