// Admin Settings: import a legacy Firebase Realtime Database JSON export.
// The backend performs additive merge only; this UI never writes database paths directly.
(function () {
  const fileInput = document.getElementById('mx-json-import-file');
  const info = document.getElementById('mx-json-import-file-info');
  const button = document.getElementById('mx-json-import-run');
  const result = document.getElementById('mx-json-import-result');
  if (!fileInput || !info || !button || !result) return;

  const MAX_BYTES = 12 * 1024 * 1024;
  let selectedFile = null;
  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sizeText = (n) => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  fileInput.addEventListener('change', () => {
    selectedFile = fileInput.files && fileInput.files[0] || null;
    result.classList.add('hidden');
    if (!selectedFile) {
      info.textContent = 'Choose a .json file from your phone.';
      button.disabled = true;
      return;
    }
    if (!/\.json$/i.test(selectedFile.name) && selectedFile.type !== 'application/json') {
      selectedFile = null; fileInput.value = '';
      info.textContent = 'Please choose a JSON file.'; button.disabled = true; return;
    }
    if (selectedFile.size > MAX_BYTES) {
      selectedFile = null; fileInput.value = '';
      info.textContent = 'File is too large. Maximum supported size is 12 MB.'; button.disabled = true; return;
    }
    info.textContent = selectedFile.name + ' · ' + sizeText(selectedFile.size) + ' · Ready to import';
    button.disabled = false;
  });

  button.addEventListener('click', async () => {
    if (!selectedFile || button.disabled) return;
    const file = selectedFile;
    if (!confirm('Import this JSON using safe Merge mode? Existing records and metadata will not be deleted or overwritten.')) return;
    button.disabled = true;
    const oldLabel = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Validating and importing...';
    result.classList.remove('hidden');
    result.textContent = 'Reading and validating JSON...';
    try {
      const text = await file.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('The selected file is not valid JSON.'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON root must be an object exported from Firebase Realtime Database.');
      const report = await mxApi('POST', '/api/admin/import-json', data);
      const rows = [
        ['Records checked', report.scanned],
        ['New records added', report.added],
        ['Existing series merged', report.merged],
        ['New movies', report.addedMovies],
        ['New series', report.addedSeries],
        ['New seasons', report.addedSeasons],
        ['New episodes', report.addedEpisodes],
        ['Duplicate records skipped', report.duplicate],
        ['Duplicate episodes skipped', report.duplicateEpisodes],
        ['Invalid records skipped', report.skipped],
      ];
      result.innerHTML = '<div class="font-bold text-emerald-400 mb-2"><i class="fas fa-check-circle mr-2"></i>Import completed</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' + rows.map(([k, v]) => '<div class="flex justify-between gap-3 border-b border-gray-700 py-1"><span class="text-gray-400">' + escapeHtml(k) + '</span><b>' + Number(v || 0) + '</b></div>').join('') + '</div>' +
        '<div class="mt-3 text-xs text-gray-400">Existing data deleted: 0 · Existing metadata overwritten: 0</div>' +
        ((report.issues || []).length ? '<details class="mt-3"><summary class="cursor-pointer text-amber-300">Show skipped-item details (' + report.issues.length + ')</summary><ul class="list-disc pl-5 mt-2 space-y-1 text-xs text-gray-400">' + report.issues.map(x => '<li>' + escapeHtml(x) + '</li>').join('') + '</ul></details>' : '');
      selectedFile = null;
      fileInput.value = '';
      info.textContent = 'Import finished. Choose another JSON file if needed.';
    } catch (err) {
      result.innerHTML = '<div class="font-bold text-red-400 mb-1"><i class="fas fa-exclamation-circle mr-2"></i>Import failed</div><div class="text-xs text-gray-300">' + escapeHtml(err.message || err.code || 'Unknown error') + '</div>';
    } finally {
      button.innerHTML = oldLabel;
      button.disabled = !selectedFile;
    }
  });
})();
