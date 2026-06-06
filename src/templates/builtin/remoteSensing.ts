import type { BuiltinTemplate, TemplateFile } from '../types';
import { templateFile } from '../utils';
import isprsCls from '../vendor/isprs/isprs.cls?raw';
import isprsBst from '../vendor/isprs/isprs.bst?raw';

const REMOTE_SAMPLE_BIB = String.raw`@article{zhu2017deeplearning,
  title   = {Deep learning in remote sensing: a comprehensive review and list of resources},
  author  = {Zhu, Xiao Xiang and Tuia, Devis and Mou, Lichao and Xia, Gui-Song and Zhang, Liangpei and Xu, Feng and Fraundorfer, Friedrich},
  journal = {IEEE Geoscience and Remote Sensing Magazine},
  year    = {2017},
  volume  = {5},
  number  = {4},
  pages   = {8--36},
  doi     = {10.1109/MGRS.2017.2762307}
}

@article{belgiu2016randomforest,
  title   = {Random forest in remote sensing: A review of applications and future directions},
  author  = {Belgiu, Mariana and Drăguţ, Lucian},
  journal = {ISPRS Journal of Photogrammetry and Remote Sensing},
  year    = {2016},
  volume  = {114},
  pages   = {24--31},
  doi     = {10.1016/j.isprsjprs.2016.01.011}
}
`;

function commonLatexFiles(id: string, mainFile = 'main.tex'): TemplateFile[] {
  return [
    templateFile('.latex-template.json', JSON.stringify({ id, mainFile, createdBy: 'Scholia Studio' }, null, 2) + '\n'),
    templateFile('refs.bib', REMOTE_SAMPLE_BIB),
    templateFile('figures/.gitkeep', ''),
    templateFile('latexmkrc', String.raw`$pdf_mode = 1;
$pdflatex = 'pdflatex -interaction=nonstopmode -synctex=1 -file-line-error %O %S';
$bibtex_use = 2;
`),
    templateFile('.gitignore', String.raw`*.aux
*.bbl
*.blg
*.fdb_latexmk
*.fls
*.log
*.out
*.spl
*.synctex.gz
*.pdf
`),
  ];
}

export function createIsprsFullPaperTemplate(): BuiltinTemplate {
  const id = 'isprs-archives-annals-full-paper';
  return {
    id,
    name: 'ISPRS Archives / Annals Full Paper',
    kind: 'latex',
    description: 'ISPRS 会议全文模板，使用公开 isprs.cls / isprs.bst。',
    mainFile: 'main.tex',
    engine: 'pdflatex/latexmk',
    bibliography: 'refs.bib',
    provider: {
      id: 'isprs',
      name: 'ISPRS',
      homepage: 'https://www.isprs.org/',
    },
    source: {
      repository: 'https://github.com/myst-templates/isprs',
      upstreamPath: 'template.tex, isprs.cls, isprs.bst',
      documentation: 'https://www.isprs.org/documents/orangebook/app5.aspx',
      note: '模板结构对应 myst-templates/isprs 公开模板；不再使用 article 类伪造 ISPRS 版式。',
    },
    license: { name: 'Upstream ISPRS template files; app starter content follows project license.' },
    tags: ['会议', '遥感', '摄影测量', 'ISPRS', '官方来源', 'LaTeX', '双栏'],
    files: [
      templateFile('README.md', String.raw`# ISPRS Archives / Annals Full Paper

本项目对应公开模板仓库：

- https://github.com/myst-templates/isprs
- https://www.isprs.org/documents/orangebook/app5.aspx

重要：本模板不再用自制 article 版式模拟 ISPRS。正式使用时应保持官方 \\documentclass{isprs}、isprs.cls 和 isprs.bst。isprs.cls 与 isprs.bst 已随模板写入项目根目录；后续如需更新，可直接用上游同名文件替换。
`),
      templateFile('main.tex', String.raw`% !TEX root = main.tex
% !TEX program = pdflatex
% Official source family: https://github.com/myst-templates/isprs
% Keep the isprs document class and bibliography style for ISPRS submissions.
\documentclass{isprs}

\usepackage{subfigure}
\usepackage{setspace}
\usepackage{geometry}
\usepackage{epstopdf}
\usepackage[labelsep=period]{caption}
\usepackage[british]{babel}
\usepackage[hang]{footmisc}
\usepackage{amsmath}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{url}

\geometry{a4paper, top=25mm, left=20mm, right=20mm, bottom=25mm, headsep=10mm, footskip=12mm}
\captionsetup{justification=centering,font=normal}
\captionsetup[figure]{font=small}
\captionsetup[table]{font=small}

\begin{document}

\title{A Photogrammetry and Remote Sensing Full Paper for ISPRS Events}

\author{First Author\textsuperscript{a,}\thanks{Corresponding Author: first.author@example.com},
Second Author\textsuperscript{b}}

\address{\textsuperscript{a} Department of Geospatial Science, University, City, Country\\
\textsuperscript{b} Institute of Photogrammetry and Remote Sensing, City, Country}

\commission{III, }{4}
\workinggroup{III/4}
\icwg{}

\abstract{This abstract summarizes the problem, data, method, experiments, and contribution. For ISPRS Archives or Annals submissions, keep the abstract concise and follow the current event call and ISPRS author guidelines.}

\keywords{Photogrammetry, Remote Sensing, Point Cloud, Earth Observation, Deep Learning}

\maketitle

\section{Introduction}
ISPRS papers normally describe a geospatial problem, the sensor or data source, the proposed method, and validation evidence. Remote sensing and photogrammetry studies often combine geometric reasoning with learning-based interpretation~\cite{belgiu2016randomforest,zhu2017deeplearning}.

\section{Related Work}
Discuss the closest ISPRS, photogrammetry, remote sensing, and spatial information science literature. Clarify how the proposed work differs from existing approaches.

\section{Materials and Methods}
Describe the study area, sensors, preprocessing, annotations, model, and evaluation protocol.
\begin{equation}
  \hat{y}=f(x;\theta),
\end{equation}
where $x$ is the input observation and $\theta$ denotes model parameters.

\subsection{Data}
List image, point cloud, or GIS data sources and their spatial resolution, acquisition date, coordinate reference system, and licensing constraints.

\subsection{Method}
Explain the processing workflow clearly enough for reproduction.

\section{Experiments and Results}
Report quantitative results and representative qualitative examples.

\begin{table}[t]
\centering
\caption{Example accuracy assessment.}
\begin{tabular}{lccc}
\toprule
Method & OA & F1 & RMSE \\
\midrule
Baseline & 0.82 & 0.76 & 4.20 \\
Proposed & 0.90 & 0.85 & 2.80 \\
\bottomrule
\end{tabular}
\end{table}

\section{Discussion}
Discuss robustness, uncertainty, generalization to other scenes, and limitations.

\section{Conclusions}
Summarize the main contribution and future work.

\section*{Acknowledgements}
Acknowledge funding, data providers, and reviewers as appropriate.

{\begin{spacing}{1.17}
\normalsize
\bibliography{refs}
\end{spacing}}

\end{document}
`),
      templateFile('UPSTREAM_FILES.md', String.raw`# ISPRS upstream files

This project includes the reusable upstream files copied from the public ISPRS template repository:

- isprs.cls: https://github.com/myst-templates/isprs/blob/main/isprs.cls
- isprs.bst: https://github.com/myst-templates/isprs/blob/main/isprs.bst
- template.tex reference: https://github.com/myst-templates/isprs/blob/main/template.tex

Scholia Studio writes isprs.cls and isprs.bst into the project root so the template can compile without an extra manual copy step. To update the official template later, replace the two local files with the upstream versions.
`),
      templateFile('isprs.cls', isprsCls),
      templateFile('isprs.bst', isprsBst),
      ...commonLatexFiles(id),
    ],
  };
}

export function createIeeeTgrsTemplate(): BuiltinTemplate {
  const id = 'ieee-transactions-geoscience-remote-sensing';
  return {
    id,
    name: 'IEEE Transactions on Geoscience and Remote Sensing',
    kind: 'latex',
    description: 'IEEE TGRS 官方 Overleaf 模板对应稿件。',
    mainFile: 'main.tex',
    engine: 'pdflatex/latexmk',
    bibliography: 'refs.bib',
    provider: { id: 'ieee', name: 'IEEE', homepage: 'https://www.grss-ieee.org/' },
    source: {
      documentation: 'https://www.overleaf.com/latex/templates/ieee-transactions-on-geoscience-and-remote-sensing-official-ieee-latex-template/mjsdtvfttpcy',
      upstreamPath: 'bare_jrnl.tex / IEEEtran.cls',
      note: '对应单一期刊 TGRS；使用官方 IEEEtran 文档类，不再合并 JSTARS。',
    },
    license: { name: 'IEEEtran class from TeX distribution; starter content follows project license.' },
    tags: ['期刊', '遥感', 'IEEE', 'TGRS', '官方来源', 'LaTeX', '双栏'],
    files: [
      templateFile('README.md', String.raw`# IEEE Transactions on Geoscience and Remote Sensing

来源：

- https://www.overleaf.com/latex/templates/ieee-transactions-on-geoscience-and-remote-sensing-official-ieee-latex-template/mjsdtvfttpcy
- https://www.grss-ieee.org/publications/author-resources/tgrs-information-for-authors/

该模板只对应 IEEE Transactions on Geoscience and Remote Sensing，不再和 JSTARS 合并。需要本机 TeX 发行版包含 IEEEtran。
`),
      templateFile('main.tex', String.raw`% !TEX root = main.tex
% !TEX program = pdflatex
% Official template family: IEEE TGRS official Overleaf template / IEEEtran.
\documentclass[journal]{IEEEtran}

\usepackage{cite}
\usepackage{amsmath,amssymb,amsfonts}
\usepackage{algorithmic}
\usepackage{graphicx}
\usepackage{textcomp}
\usepackage{xcolor}
\usepackage{booktabs}
\usepackage[hidelinks]{hyperref}

\hyphenation{op-tical net-works semi-conduc-tor}

\begin{document}

\title{A Remote Sensing Manuscript for IEEE Transactions on Geoscience and Remote Sensing}

\author{First~Author,~\IEEEmembership{Member,~IEEE},
        and~Second~Author,~\IEEEmembership{Senior~Member,~IEEE}%
\thanks{Manuscript received Month Day, 2026; revised Month Day, 2026.}%
\thanks{First Author is with the Department, University, City, Country (e-mail: first.author@example.com).}%
\thanks{Second Author is with the Institute, City, Country.}}

\markboth{IEEE Transactions on Geoscience and Remote Sensing,~Vol.~XX, No.~X, Month~2026}%
{Author \MakeLowercase{\textit{et al.}}: Manuscript Title}

\maketitle

\begin{abstract}
This abstract states the remote sensing problem, the sensor or data modality, the proposed method, the experimental protocol, and the main quantitative findings. Keep the abstract concise and emphasize the geoscience or Earth observation contribution.
\end{abstract}

\begin{IEEEkeywords}
Remote sensing, geoscience, Earth observation, synthetic aperture radar, hyperspectral image analysis, deep learning.
\end{IEEEkeywords}

\section{Introduction}
\IEEEPARstart{R}{emote} sensing research for TGRS should clearly connect methodological novelty with geoscience observation, measurement, or interpretation. The introduction should motivate the problem, review closely related work, and summarize the contributions~\cite{zhu2017deeplearning,belgiu2016randomforest}.

\section{Related Work}
Organize related studies by data modality, task, or methodological family. Explain why existing approaches are insufficient for the target geoscience problem.

\section{Methodology}
Describe the proposed model or processing chain.
\begin{equation}
  \hat{y}=\arg\max_{c} p(c\mid x,\theta),
\end{equation}
where $x$ denotes an observed remote sensing sample and $\theta$ denotes learned parameters.

\section{Experiments}
Describe datasets, train/test splits, baselines, metrics, and implementation details.

\begin{table}[t]
\caption{Example quantitative comparison on a remote sensing benchmark.}
\label{tab:example-results}
\centering
\begin{tabular}{lccc}
\toprule
Method & OA (\%) & mIoU (\%) & F1 (\%) \\
\midrule
Baseline & 82.1 & 61.4 & 76.0 \\
Proposed & 89.7 & 70.2 & 85.1 \\
\bottomrule
\end{tabular}
\end{table}

\section{Discussion}
Discuss ablations, sensitivity, uncertainty, failure cases, and transferability across sensors or regions.

\section{Conclusion}
Summarize the major findings and identify future research directions.

\section*{Acknowledgment}
Acknowledge funding, data providers, and collaborators as appropriate.

\bibliographystyle{IEEEtran}
\bibliography{refs}

\end{document}
`),
      ...commonLatexFiles(id),
    ],
  };
}

export function createRemoteSensingOfEnvironmentTemplate(): BuiltinTemplate {
  const id = 'elsevier-remote-sensing-of-environment';
  return {
    id,
    name: 'Remote Sensing of Environment',
    kind: 'latex',
    description: 'Elsevier RSE 稿件模板，使用 elsarticle。',
    mainFile: 'main.tex',
    engine: 'pdflatex/latexmk',
    bibliography: 'refs.bib',
    provider: { id: 'elsevier', name: 'Elsevier', homepage: 'https://www.elsevier.com/' },
    source: {
      documentation: 'https://www.elsevier.com/researcher/author/policies-and-guidelines/latex-instructions',
      upstreamPath: 'elsarticle.cls / elsarticle-template',
      note: '对应单一期刊 Remote Sensing of Environment；使用 Elsevier 官方 elsarticle 工作流。',
    },
    license: { name: 'elsarticle class from TeX distribution; starter content follows project license.' },
    tags: ['期刊', '遥感', 'Elsevier', 'RSE', '官方来源', 'LaTeX'],
    files: [
      templateFile('README.md', String.raw`# Remote Sensing of Environment

来源：

- https://www.elsevier.com/researcher/author/policies-and-guidelines/latex-instructions
- https://ctan.org/pkg/elsarticle

该模板只对应 Remote Sensing of Environment，不再作为“Elsevier 遥感期刊”通用模板。需要本机 TeX 发行版包含 elsarticle。
`),
      templateFile('main.tex', String.raw`% !TEX root = main.tex
% !TEX program = pdflatex
% Official template family: Elsevier elsarticle.
\documentclass[preprint,review,12pt,authoryear]{elsarticle}

\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage[hidelinks]{hyperref}

\journal{Remote Sensing of Environment}

\begin{document}

\begin{frontmatter}

\title{Environmental Remote Sensing Manuscript Title}

\author[inst1]{First Author\corref{cor1}}
\ead{first.author@example.com}
\author[inst2]{Second Author}
\ead{second.author@example.com}

\affiliation[inst1]{organization={Department of Environmental Remote Sensing, University}, city={City}, country={Country}}
\affiliation[inst2]{organization={Institute of Earth Observation}, city={City}, country={Country}}

\cortext[cor1]{Corresponding author}

\begin{abstract}
This abstract frames the environmental question, remote sensing data, method, validation strategy, and environmental finding. For Remote Sensing of Environment, emphasize the environmental contribution rather than only algorithmic performance.
\end{abstract}

\begin{keyword}
Remote sensing \sep Environmental monitoring \sep Earth observation \sep Validation \sep Uncertainty
\end{keyword}

\end{frontmatter}

\section{Introduction}
Remote Sensing of Environment manuscripts should foreground the environmental science question and explain why remote sensing is necessary for answering it. Cite representative remote sensing literature using author--year citations, for example \citet{belgiu2016randomforest} and \citet{zhu2017deeplearning}.

\section{Study Area and Data}
Describe the study area, remote sensing products, in situ reference data, temporal coverage, preprocessing, and quality control.

\section{Methods}
Explain the retrieval, classification, regression, or data fusion method.
\begin{equation}
  E = g(X, Z; \theta),
\end{equation}
where $E$ is the environmental variable of interest, $X$ denotes remote sensing observations, and $Z$ denotes auxiliary variables.

\section{Results}
Present environmental findings together with validation evidence.

\begin{table}[t]
\centering
\caption{Example validation metrics for environmental retrieval.}
\label{tab:rse-validation}
\begin{tabular}{lccc}
\toprule
Method & RMSE & MAE & $R^2$ \\
\midrule
Baseline & 4.20 & 3.10 & 0.71 \\
Proposed & 2.80 & 2.05 & 0.84 \\
\bottomrule
\end{tabular}
\end{table}

\section{Discussion}
Discuss environmental interpretation, uncertainty, sensor limitations, spatial transferability, and implications for monitoring or management.

\section{Conclusions}
Summarize the environmental insight, validated performance, and limitations.

\section*{Declaration of competing interest}
The authors declare that they have no known competing financial interests or personal relationships that could have appeared to influence the work reported in this paper.

\section*{Data availability}
Data and code availability statements should be completed before submission.

\section*{Acknowledgements}
Acknowledge funding, data providers, and collaborators as appropriate.

\bibliographystyle{elsarticle-harv}
\bibliography{refs}

\end{document}
`),
      ...commonLatexFiles(id),
    ],
  };
}
