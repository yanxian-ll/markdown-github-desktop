import type { BuiltinTemplate } from '../types';

const CSU_THESIS_FILES = [
  {
    "path": ".latex-template.json",
    "content": "{\n  \"id\": \"csu-thesis-graduate\",\n  \"name\": \"CSUthesis 中南大学研究生学位论文\",\n  \"source\": {\n    \"repository\": \"https://github.com/CSUcse/CSUthesis\",\n    \"referenceCatalog\": \"https://github.com/hantang/latex-templates\"\n  },\n  \"engine\": \"xelatex\",\n  \"mainFile\": \"csuthesis_main.tex\",\n  \"notes\": [\n    \"内置版本采用 Scholia Studio 的轻量兼容骨架，目录和主文件组织参考 CSUcse/CSUthesis。\",\n    \"如果需要学校最终提交级的完整样式，请将上游 CSUthesis.cls 与 bst 等文件覆盖到本目录；本项目模板注册架构已为完整 vendor 文件预留入口。\"\n  ]\n}\n"
  },
  {
    "path": "README.md",
    "content": "# CSUthesis 中南大学研究生学位论文模板（Scholia 内置版）\n\n这个目录由 Scholia Studio 内置模板生成，目标是让你在应用内直接得到一个可编辑、可扩展、可构建的中南大学研究生论文项目骨架。\n\n## 结构\n\n- `csuthesis_main.tex`：主文件，已声明 `% !TEX program = xelatex`。\n- `CSUthesis.cls`：轻量兼容类文件，提供封面、扉页、声明、摘要、符号说明等基础命令。\n- `content/info.tex`：论文题名、作者、导师、学院、学科等元数据。\n- `content/abstractcn.tex`、`content/abstracten.tex`：中英文摘要。\n- `content/content.tex`：正文示例。\n- `content/denotation.tex`：符号说明。\n- `content/appendix.tex`：附录。\n- `content/additional.tex`：成果与致谢。\n- `thesis-references.bib`：参考文献示例。\n- `latexmkrc`：将 latexmk 默认引擎设置为 XeLaTeX。\n\n## 编译\n\n建议使用 XeLaTeX：\n\n```bash\nlatexmk -xelatex -interaction=nonstopmode -synctex=1 -file-line-error csuthesis_main.tex\n```\n\n在 Scholia Studio 中打开 `csuthesis_main.tex` 后点击构建即可。应用会识别文件头的 `% !TEX program = xelatex`。\n\n## 与上游 CSUthesis 的关系\n\n本模板不是对上游仓库的完整复制，而是一个便于在 Scholia Studio 内快速创建、调试和后续替换的轻量集成骨架。目录命名、主文件入口和常见内容拆分参考 `CSUcse/CSUthesis`。如需学校最终提交级别的完整格式，请以官方/上游仓库最新文件为准，并把上游 `CSUthesis.cls`、参考文献样式文件和图片资源覆盖进本目录。\n\n## 后续扩展建议\n\n- 增加完整 vendor 导入：把上游模板作为版本化模板包落在 `src/templates/builtin/csuthesis/vendor/`。\n- 在模板 manifest 中增加变量 schema：创建项目时填写姓名、学院、学位类型、盲审模式等。\n- 为不同学位类型拆出 variant：博士、硕士、学术型、专业型、盲审版。\n"
  },
  {
    "path": "latexmkrc",
    "content": "# CSUthesis needs XeLaTeX because it depends on CTeX/xeCJK font handling.\n$pdf_mode = 5;\n$xelatex = 'xelatex -interaction=nonstopmode -synctex=1 -file-line-error %O %S';\n$bibtex_use = 2;\n"
  },
  {
    "path": "Makefile",
    "content": "MAIN=csuthesis_main\n\nall:\n\tlatexmk -xelatex -interaction=nonstopmode -synctex=1 -file-line-error $(MAIN).tex\n\nclean:\n\tlatexmk -C $(MAIN).tex\n\trm -f *.synctex.gz\n"
  },
  {
    "path": ".gitignore",
    "content": "*.aux\n*.bbl\n*.blg\n*.fdb_latexmk\n*.fls\n*.log\n*.out\n*.toc\n*.lof\n*.lot\n*.synctex.gz\n*.xdv\n*.pdf\n"
  },
  {
    "path": "CSUthesis.cls",
    "content": "%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%\n% Scholia Studio CSUthesis compatible starter class\n% This lightweight class preserves the project shape and common author-facing\n% commands of https://github.com/CSUcse/CSUthesis for in-app template creation.\n% Replace this file with the upstream class if you need final submission layout.\n%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%\n\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesClass{CSUthesis}[2026/06/06 Scholia Studio CSU thesis starter]\n\n\\LoadClass[UTF8,a4paper,zihao=-4,openany]{ctexbook}\n\n\\RequirePackage{ifxetex}\n\\RequireXeTeX\n\\RequirePackage{geometry}\n\\RequirePackage{setspace}\n\\RequirePackage{graphicx}\n\\RequirePackage{booktabs}\n\\RequirePackage{longtable}\n\\RequirePackage{amsmath,amssymb,bm}\n\\RequirePackage{hyperref}\n\\RequirePackage{caption}\n\\RequirePackage{subcaption}\n\\RequirePackage{enumitem}\n\\RequirePackage{fancyhdr}\n\\RequirePackage{titlesec}\n\\RequirePackage{natbib}\n\n\\geometry{top=25.4mm,bottom=25.4mm,left=31.4mm,right=31.4mm}\n\\hypersetup{colorlinks=true,linkcolor=black,citecolor=black,urlcolor=black}\n\\setstretch{1.25}\n\\setlength{\\parindent}{2em}\n\\setlength{\\parskip}{0pt}\n\n\\newif\\ifDoctor\n\\newif\\ifAcademic\n\\newif\\ifblindreview\n\\Doctortrue\n\\Academictrue\n\\blindreviewfalse\n\n\\DeclareOption{doctor}{\\Doctortrue}\n\\DeclareOption{master}{\\Doctorfalse}\n\\DeclareOption{academic}{\\Academictrue}\n\\DeclareOption{professional}{\\Academicfalse}\n\\DeclareOption{blind}{\\blindreviewtrue}\n\\ProcessOptions\\relax\n\n\\makeatletter\n\\gdef\\@titlecn{中文题名}\n\\gdef\\@titleen{English Title}\n\\gdef\\@author{作者姓名}\n\\gdef\\@priormajor{一级学科/专业学位类别}\n\\gdef\\@minormajor{二级学科/专业领域}\n\\gdef\\@interestmajor{研究方向}\n\\gdef\\@department{二级培养单位}\n\\gdef\\@supervisor{指导教师}\n\\gdef\\@subsupervisor{副指导教师}\n\\gdef\\@studentid{0000000000}\n\\gdef\\@clcnumber{TP391}\n\\gdef\\@schoolcode{10533}\n\\gdef\\@udc{004}\n\\gdef\\@academiccategory{工学}\n\\gdef\\@thesisdate{2026 年 6 月}\n\\gdef\\@keywordscn{关键词一；关键词二；关键词三}\n\\gdef\\@keywordsen{keyword one; keyword two; keyword three}\n\\gdef\\@categorycn{TP391}\n\\gdef\\@categoryen{TP391}\n\\gdef\\@itemcountcn{图 0 幅，表 0 个，参考文献 0 篇。}\n\n\\newcommand*{\\titlecn}[1]{\\gdef\\@titlecn{#1}}\n\\newcommand*{\\titleen}[1]{\\gdef\\@titleen{#1}}\n\\renewcommand*{\\author}[1]{\\gdef\\@author{#1}}\n\\newcommand*{\\priormajor}[1]{\\gdef\\@priormajor{#1}}\n\\newcommand*{\\minormajor}[1]{\\gdef\\@minormajor{#1}}\n\\newcommand*{\\interestmajor}[1]{\\gdef\\@interestmajor{#1}}\n\\newcommand*{\\department}[1]{\\gdef\\@department{#1}}\n\\newcommand*{\\supervisor}[1]{\\gdef\\@supervisor{#1}}\n\\newcommand*{\\subsupervisor}[1]{\\gdef\\@subsupervisor{#1}}\n\\newcommand*{\\studentid}[1]{\\gdef\\@studentid{#1}}\n\\newcommand*{\\clcnumber}[1]{\\gdef\\@clcnumber{#1}}\n\\newcommand*{\\schoolcode}[1]{\\gdef\\@schoolcode{#1}}\n\\newcommand*{\\udc}[1]{\\gdef\\@udc{#1}}\n\\newcommand*{\\academiccategory}[1]{\\gdef\\@academiccategory{#1}}\n\\newcommand*{\\keywordscn}[1]{\\gdef\\@keywordscn{#1}}\n\\newcommand*{\\keywordsen}[1]{\\gdef\\@keywordsen{#1}}\n\\newcommand*{\\categorycn}[1]{\\gdef\\@categorycn{#1}}\n\\newcommand*{\\categoryen}[1]{\\gdef\\@categoryen{#1}}\n\\newcommand*{\\itemcountcn}[1]{\\gdef\\@itemcountcn{#1}}\n\n\\newcommand{\\thesisdate}[1]{%\n  \\def\\csu@year{2026}\\def\\csu@month{6}%\n  \\@for\\csu@pair:=#1\\do{\\expandafter\\csu@parse@date\\csu@pair==\\@nil}%\n  \\gdef\\@thesisdate{\\csu@year{} 年 \\csu@month{} 月}%\n}\n\\def\\csu@parse@date#1=#2=#3\\@nil{%\n  \\def\\csu@key{#1}\\def\\csu@value{#2}%\n  \\ifx\\csu@key\\@empty\\else\n    \\edef\\csu@keytrim{\\zap@space#1 \\@empty}%\n    \\ifx\\csu@keytrim\\csu@yearkey\\def\\csu@year{#2}\\fi\n    \\ifx\\csu@keytrim\\csu@monthkey\\def\\csu@month{#2}\\fi\n  \\fi\n}\n\\def\\csu@yearkey{year}\n\\def\\csu@monthkey{month}\n\n\\titleformat{\\chapter}{\\centering\\heiti\\zihao{3}\\bfseries}{第\\thechapter 章}{1em}{}\n\\titleformat{\\section}{\\heiti\\zihao{4}\\bfseries}{\\thesection}{1em}{}\n\\titleformat{\\subsection}{\\songti\\zihao{-4}\\bfseries}{\\thesubsection}{1em}{}\n\\fancyhf{}\n\\fancyhead[C]{\\songti\\zihao{-5}\\leftmark}\n\\fancyfoot[C]{\\thepage}\n\\pagestyle{fancy}\n\n\\newcommand{\\csu@degree@name}{\\ifDoctor 博士\\else 硕士\\fi 学位论文}\n\\newcommand{\\csu@major@label}{\\ifAcademic 一级学科\\else 专业学位类别\\fi}\n\\newcommand{\\csu@minor@label}{\\ifAcademic 二级学科\\else 专业领域\\fi}\n\n\\newcommand{\\makecoverpage}{%\n  \\begin{titlepage}\n  \\centering\n  \\vspace*{1.4cm}\n  {\\zihao{-2}\\heiti\\bfseries \\csu@degree@name\\par}\n  \\vspace{1.8cm}\n  {\\zihao{2}\\heiti\\bfseries \\@titlecn\\par}\n  \\vspace{0.5cm}\n  {\\zihao{-2}\\bfseries \\@titleen\\par}\n  \\vfill\n  {\\zihao{3}\\songti\n  \\begin{tabular}{rl}\n  \\csu@major@label：& \\@priormajor\\\\[8pt]\n  \\csu@minor@label：& \\@minormajor\\\\[8pt]\n  \\ifblindreview 研究方向：& \\@interestmajor\\\\[8pt] 学号：& \\@studentid\\\\[8pt]\n  \\else 作者姓名：& \\@author\\\\[8pt] 指导教师：& \\@supervisor\\\\[8pt]\n  \\fi\n  \\end{tabular}\\par}\n  \\vfill\n  {\\zihao{-3}\\songti 中\\quad 南\\quad 大\\quad 学\\par}\n  {\\zihao{-3}\\songti \\@thesisdate\\par}\n  \\end{titlepage}%\n}\n\n\\newcommand{\\maketitlepage}{%\n  \\cleardoublepage\n  \\thispagestyle{empty}\n  {\\zihao{4}\\songti\n  中图分类号：\\underline{\\makebox[3cm][c]{\\@clcnumber}}\\hfill\n  学校代码：\\underline{\\makebox[3cm][c]{\\@schoolcode}}\\\\[8pt]\n  UDC：\\underline{\\makebox[3cm][c]{\\@udc}}\\hfill\n  学位类别：\\underline{\\makebox[3cm][c]{\\@academiccategory}}\n  }\n  \\vspace{1.5cm}\n  \\begin{center}\n  {\\zihao{-2}\\heiti\\bfseries \\csu@degree@name\\par}\\vspace{1cm}\n  {\\zihao{2}\\heiti\\bfseries \\@titlecn\\par}\\vspace{0.4cm}\n  {\\zihao{-2}\\bfseries \\@titleen\\par}\\vspace{1.2cm}\n  {\\zihao{3}\\songti\n  \\begin{tabular}{rl}\n  作者姓名：& \\@author\\\\[8pt]\n  \\csu@major@label：& \\@priormajor\\\\[8pt]\n  \\csu@minor@label：& \\@minormajor\\\\[8pt]\n  研究方向：& \\@interestmajor\\\\[8pt]\n  二级培养单位：& \\@department\\\\[8pt]\n  指导教师：& \\@supervisor\\\\[8pt]\n  副指导教师：& \\@subsupervisor\\\\[8pt]\n  \\end{tabular}}\n  \\vfill\n  {\\zihao{-3}\\songti 中\\quad 南\\quad 大\\quad 学\\par}\n  {\\zihao{-3}\\songti \\@thesisdate\\par}\n  \\end{center}\n  \\cleardoublepage\n}\n\n\\newcommand{\\announcement}{%\n  \\cleardoublepage\n  \\chapter*{学位论文原创性声明}\n  本人郑重声明，所呈交的学位论文是本人在导师指导下进行的研究工作及取得的研究成果。除文中特别加以标注和致谢的地方外，论文中不包含其他人已经发表或撰写过的研究成果。\n\n  \\vspace{1.5cm}\n  学位论文作者签名：\\underline{\\makebox[5em][c]{}}\\hfill 日期：\\underline{\\makebox[3em][c]{}} 年 \\underline{\\makebox[1.5em][c]{}} 月 \\underline{\\makebox[1.5em][c]{}} 日\n\n  \\chapter*{学位论文版权使用授权书}\n  本学位论文作者和指导教师完全了解中南大学有关保留、使用学位论文的规定，同意学校保留并向有关部门或机构送交论文的复印件和电子版，允许论文被查阅和借阅。\n\n  \\vspace{1.5cm}\n  学位论文作者签名：\\underline{\\makebox[5em][c]{}}\\hfill 指导教师签名：\\underline{\\makebox[5em][c]{}}\n  \\cleardoublepage\n}\n\n\\newenvironment{abstractcn}{%\n  \\cleardoublepage\n  \\chapter*{摘要}\n  \\addcontentsline{toc}{chapter}{摘要}\n  \\begin{center}{\\zihao{3}\\heiti\\bfseries \\@titlecn}\\end{center}\n  \\noindent\\heiti 摘要：\\songti\n}{%\n  \\par\\vspace{1em}\\noindent\\heiti 关键词：\\songti \\@keywordscn\n  \\par\\noindent\\heiti 分类号：\\songti \\@categorycn\n  \\cleardoublepage\n}\n\n\\newenvironment{abstracten}{%\n  \\cleardoublepage\n  \\chapter*{Abstract}\n  \\addcontentsline{toc}{chapter}{Abstract}\n  \\begin{center}{\\zihao{3}\\bfseries \\@titleen}\\end{center}\n  \\noindent\\textbf{Abstract:}~\n}{%\n  \\par\\vspace{1em}\\noindent\\textbf{Keywords:}~\\@keywordsen\n  \\par\\noindent\\textbf{Classification:}~\\@categoryen\n  \\cleardoublepage\n}\n\n\\newenvironment{denotation}{%\n  \\cleardoublepage\n  \\chapter*{符号说明}\n  \\addcontentsline{toc}{chapter}{符号说明}\n}{\\cleardoublepage}\n\n\\newenvironment{achievements}{\\chapter*{攻读学位期间主要研究成果}\\addcontentsline{toc}{chapter}{攻读学位期间主要研究成果}}{}\n\\newenvironment{acknowledgements}{\\chapter*{致谢}\\addcontentsline{toc}{chapter}{致谢}}{}\n\n\\makeatother\n"
  },
  {
    "path": "csuthesis_main.tex",
    "content": "% !TEX root = csuthesis_main.tex\n% !TEX program = xelatex\n\\documentclass[doctor,academic]{CSUthesis}\n\n\\input{content/info}\n\n\\begin{document}\n\n\\frontmatter\n\\makecoverpage\n\\maketitlepage\n\\announcement\n\n\\input{content/abstractcn}\n\\input{content/abstracten}\n\n\\tableofcontents\n\\cleardoublepage\n\\input{content/denotation}\n\n\\mainmatter\n\\input{content/content}\n\n\\cleardoublepage\n\\addcontentsline{toc}{chapter}{参考文献}\n\\bibliographystyle{plain}\n\\bibliography{thesis-references}\n\n\\appendix\n\\input{content/appendix}\n\n\\backmatter\n\\input{content/additional}\n\n\\end{document}\n"
  },
  {
    "path": "content/info.tex",
    "content": "% 论文基本信息。可按需切换博士/硕士、学术型/专业型、盲审模式。\n% 推荐修改 csuthesis_main.tex 的 documentclass 选项：\n%   doctor/master, academic/professional, blind\n\n\\titlecn{面向学术写作的 Markdown 与 LaTeX 协同编辑系统研究}\n\\titleen{Research on a Collaborative Markdown and LaTeX Authoring System for Scholarly Writing}\n\\author{张三}\n\\priormajor{计算机科学与技术}\n\\minormajor{软件工程}\n\\interestmajor{智能软件工程}\n\\department{计算机学院}\n\\supervisor{李四 教授}\n\\subsupervisor{王五 副教授}\n\\studentid{2345678901}\n\\clcnumber{TP311}\n\\schoolcode{10533}\n\\udc{004.4}\n\\academiccategory{工学博士}\n\\thesisdate{year=2026,month=6}\n\n\\keywordscn{学术写作；LaTeX；Markdown；PDF 批注；同步定位}\n\\categorycn{TP311}\n\\keywordsen{scholarly writing; LaTeX; Markdown; PDF annotation; synchronization}\n\\categoryen{TP311}\n\\itemcountcn{图 1 幅，表 1 个，参考文献若干篇。}\n"
  },
  {
    "path": "content/abstractcn.tex",
    "content": "\\begin{abstractcn}\n随着科研协作方式不断变化，研究者需要在结构化写作、公式排版、文献管理、PDF 审阅与版本控制之间频繁切换。本文围绕 Markdown 与 LaTeX 协同编辑场景，设计并实现一个面向学术写作的桌面系统原型，支持项目文件管理、LaTeX 智能索引、PDF 预览、批注整理以及多格式导出等能力。\n\n本文的示例摘要用于占位。正式写作时请替换为研究背景、方法、结果与贡献。\n\\end{abstractcn}\n"
  },
  {
    "path": "content/abstracten.tex",
    "content": "\\begin{abstracten}\nResearchers frequently switch among structured writing, mathematical typesetting, reference management, PDF review, and version control. This thesis studies a collaborative authoring workflow that combines Markdown and LaTeX, and implements a desktop prototype for scholarly writing. The system supports project file management, LaTeX indexing, PDF preview, annotation management, and multi-format export.\n\nThis English abstract is a placeholder. Replace it with the background, methodology, results, and contributions of your thesis.\n\\end{abstracten}\n"
  },
  {
    "path": "content/denotation.tex",
    "content": "\\begin{denotation}\n\\begin{longtable}{ll}\n\\toprule\n符号 & 含义 \\\\\n\\midrule\n$D$ & 文档集合 \\\\\n$G$ & LaTeX 文件依赖图 \\\\\n$S$ & SyncTeX 源码与 PDF 坐标映射 \\\\\n\\bottomrule\n\\end{longtable}\n\\end{denotation}\n"
  },
  {
    "path": "content/content.tex",
    "content": "\\chapter{绪论}\n\\section{研究背景}\nLaTeX 在学位论文和学术论文写作中具有稳定的排版能力，Markdown 则具有较低的写作门槛。将二者与 PDF 批注、文献管理和版本控制结合，可以改善长文档写作体验。本文引用一条示例文献~\\cite{knuth1984texbook}。\n\n\\section{本文贡献}\n本文示例模板展示了章节、表格、公式和图片占位的基本写法。\n\n\\begin{equation}\nE = mc^2\n\\end{equation}\n\n\\begin{table}[htbp]\n\\centering\n\\caption{功能模块示例}\n\\begin{tabular}{ll}\n\\toprule\n模块 & 功能 \\\\\n\\midrule\n编辑器 & Markdown/LaTeX 编辑 \\\\\n预览器 & PDF 与 Markdown 预览 \\\\\n模板库 & 内置模板初始化 \\\\\n\\bottomrule\n\\end{tabular}\n\\end{table}\n\n\\chapter{系统设计}\n\\section{模板注册架构}\n模板库采用注册表与模板文件分离的方式组织。新增模板时，只需增加模板工厂、文件清单和 manifest 信息，再在 catalog 中注册。\n\n\\chapter{总结与展望}\n本文给出了一个 CSUthesis 风格的项目骨架。后续可接入完整上游模板包、变量化创建向导和模板市场。\n"
  },
  {
    "path": "content/appendix.tex",
    "content": "\\chapter{附录示例}\n这里放置附录材料、补充证明、问卷或额外实验结果。\n"
  },
  {
    "path": "content/additional.tex",
    "content": "\\begin{achievements}\n\\begin{enumerate}[label={[]}]\n  \\item 张三，李四. 面向学术写作的协同编辑系统研究. 示例期刊，2026.\n\\end{enumerate}\n\\end{achievements}\n\n\\begin{acknowledgements}\n感谢导师和课题组成员在论文写作过程中提供的帮助。本段为占位内容，正式提交前请替换。\n\\end{acknowledgements}\n"
  },
  {
    "path": "thesis-references.bib",
    "content": "@book{knuth1984texbook,\n  title={The TeXbook},\n  author={Knuth, Donald E.},\n  year={1984},\n  publisher={Addison-Wesley}\n}\n"
  },
  {
    "path": "images/.gitkeep",
    "content": ""
  }
];

export function createCsuThesisTemplate(): BuiltinTemplate {
  return {
    id: 'csu-thesis-graduate',
    name: 'CSUthesis 中南大学研究生学位论文',
    kind: 'latex',
    description: '中南大学研究生学位论文项目骨架，内置主文件、content 分章、XeLaTeX 配置和轻量兼容类文件。',
    mainFile: 'csuthesis_main.tex',
    engine: 'xelatex + bibtex/latexmk',
    bibliography: 'thesis-references.bib',
    provider: {
      id: 'csu-thesis',
      name: 'CSUthesis / Scholia Studio adapter',
      description: '目录组织参考 CSUcse/CSUthesis，模板注册方式参考 latex-templates 的集中目录思想。',
      homepage: 'https://github.com/CSUcse/CSUthesis',
    },
    source: {
      repository: 'https://github.com/CSUcse/CSUthesis',
      documentation: 'https://github.com/CSUcse/CSUthesis#readme',
      note: '内置轻量兼容骨架，不是上游仓库的完整 vendor 复制；后续可在同一模板工厂下替换为完整文件包。',
    },
    license: {
      name: 'Adapter source in this app; upstream files should keep their original license/notice when vendored.',
    },
    tags: ['毕业论文', '中文', 'LaTeX', 'CSU', 'XeLaTeX'],
    files: CSU_THESIS_FILES,
    roadmap: [
      '下一步可将上游 CSUthesis.cls、bst 和 images 完整 vendor 到 src/templates/builtin/csuthesis/vendor。',
      '增加创建向导：博士/硕士、学术/专业、盲审模式、学院和导师等变量化填写。',
      '按 latex-templates 风格增加模板索引字段：地区、学校、学位类型、引擎、许可证和上游版本。',
    ],
  };
}
