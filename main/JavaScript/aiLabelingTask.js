const selectAll =
    document.getElementById('selectAll');

const documentCheckboxes =
    document.querySelectorAll('.document-checkbox');

const selectedCounter =
    document.getElementById('selectedCounter');

const selectedCount =
    document.getElementById('selectedCount');


// ================================
// SELECT ALL
// ================================

selectAll.addEventListener('change', function () {

    if (this.checked) {

        // Show checkboxes
        documentCheckboxes.forEach(checkbox => {

            checkbox.classList.remove('hidden');

            checkbox.checked = true;

        });

        // Show counter
        selectedCounter.classList.remove('hidden');

        updateSelectedCount();

    } else {

        // Hide checkboxes
        documentCheckboxes.forEach(checkbox => {

            checkbox.checked = false;

            checkbox.classList.add('hidden');

        });

        // Hide counter
        selectedCounter.classList.add('hidden');

        updateSelectedCount();

    }

});


// ================================
// INDIVIDUAL CHECKBOX
// ================================

documentCheckboxes.forEach(checkbox => {

    checkbox.addEventListener('change', function () {

        updateSelectedCount();

    });

});


// ================================
// UPDATE COUNTER
// ================================

function updateSelectedCount() {

    const count =
        document.querySelectorAll(
            '.document-checkbox:checked'
        ).length;

    selectedCount.textContent =
        `${count} document${count !== 1 ? 's' : ''}`;

}