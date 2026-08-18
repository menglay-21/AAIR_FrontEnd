const documentItems =
    document.querySelectorAll('.document-item');

const pdfViewer =
    document.getElementById('pdfViewer');

const pdfTitle =
    document.getElementById('pdfTitle');

const pdfEmptyState =
    document.getElementById('pdfEmptyState');


documentItems.forEach(item => {

    item.addEventListener('click', function () {

        const pdfPath = this.dataset.pdf;
        const title = this.dataset.title;


        // Load PDF
        pdfViewer.src = pdfPath;


        // Update title
        pdfTitle.textContent = title;


        // Hide empty state
        pdfEmptyState.classList.add('hidden');


        // Show PDF
        pdfViewer.classList.remove('hidden');


        // Remove active state
        documentItems.forEach(doc => {

            doc.classList.remove(
                'bg-primary-container',
                'text-primary',
                'font-semibold'
            );

        });


        // Highlight selected document
        this.classList.add(
            'bg-primary-container',
            'text-primary',
            'font-semibold'
        );

    });

});