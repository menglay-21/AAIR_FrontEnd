import * as pdfjsLib from './pdf.min.mjs';

globalThis.pdfjsLib = pdfjsLib;

const {
    EventBus,
    PDFLinkService,
    PDFViewer,
} = await import('./pdf_viewer.mjs');

pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';

const params = new URLSearchParams(location.search);
const file = params.get('file');
const title = params.get('title') || 'Tài liệu PDF';
const container = document.querySelector('#viewerContainer');
const viewerElement = document.querySelector('#viewer');
const message = document.querySelector('#viewerMessage');
const pageNumber = document.querySelector('#pageNumber');
const pageCount = document.querySelector('#pageCount');
const zoomValue = document.querySelector('#zoomValue');
const zoomOut = document.querySelector('#zoomOut');
const zoomIn = document.querySelector('#zoomIn');
const documentTitle = document.querySelector('#documentTitle');

document.title = title;
documentTitle.textContent = title;

const eventBus = new EventBus();
const linkService = new PDFLinkService({ eventBus });
const pdfViewer = new PDFViewer({
    container,
    eventBus,
    linkService,
    textLayerMode: 1,
    removePageBorders: true,
});
linkService.setViewer(pdfViewer);

const clampScale = scale => Math.min(4, Math.max(0.25, scale));
const setScale = scale => {
    pdfViewer.currentScale = clampScale(scale);
};

eventBus.on('pagesinit', () => {
    setScale(1);
    pdfViewer.currentPageNumber = 1;
    message.hidden = true;
});
eventBus.on('pagesloaded', ({ pagesCount }) => {
    pageCount.textContent = String(pagesCount);
    pageNumber.max = String(pagesCount);
});
eventBus.on('pagechanging', ({ pageNumber: currentPage }) => {
    pageNumber.value = String(currentPage);
});
eventBus.on('scalechanging', ({ scale }) => {
    zoomValue.value = `${Math.round(scale * 100)}%`;
    zoomValue.textContent = zoomValue.value;
});

pageNumber.addEventListener('change', () => {
    const nextPage = Math.min(pdfViewer.pagesCount, Math.max(1, Number(pageNumber.value) || 1));
    pdfViewer.currentPageNumber = nextPage;
});
zoomOut.addEventListener('click', () => setScale(pdfViewer.currentScale / 1.1));
zoomIn.addEventListener('click', () => setScale(pdfViewer.currentScale * 1.1));

if (!file) {
    message.textContent = 'Không tìm thấy đường dẫn tài liệu PDF.';
    message.style.color = '#b91c1c';
} else {
    try {
        const loadingTask = pdfjsLib.getDocument({ url: file });
        const pdfDocument = await loadingTask.promise;
        pageCount.textContent = String(pdfDocument.numPages);
        pageNumber.max = String(pdfDocument.numPages);
        pdfViewer.setDocument(pdfDocument);
        linkService.setDocument(pdfDocument, null);
    } catch (error) {
        console.error(error);
        message.textContent = 'Không tải được tài liệu PDF.';
        message.style.color = '#b91c1c';
    }
}
