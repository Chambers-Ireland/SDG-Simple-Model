/* Chambers Ireland Business Sustainability Action Planner PDF exporter.
   Zero external dependencies: chosen actions and notes remain in the browser. */
(function (global) {
  'use strict';

  const PAGE_WIDTH = 595.28; // A4, PDF points
  const PAGE_HEIGHT = 841.89;
  const LEFT = 48;
  const RIGHT = PAGE_WIDTH - LEFT;
  const TEXT_WIDTH = RIGHT - LEFT;
  const NAVY = [0.051, 0.243, 0.463];  // #0D3E76
  const GOLD = [0.847, 0.635, 0.043];  // #D8A20B
  const BODY = [0.090, 0.149, 0.220];
  const MUTED = [0.333, 0.402, 0.471];
  const SOFT = [0.93, 0.953, 0.976];

  // Standard PDF Helvetica uses Windows-1252. Encode text as hex strings so
  // ampersands, parentheses, curly apostrophes and Irish accents are safe.
  const EXTRA = {
    8364: 128, 8218: 130, 402: 131, 8222: 132, 8230: 133, 8224: 134,
    8225: 135, 710: 136, 8240: 137, 352: 138, 8249: 139, 338: 140,
    381: 142, 8216: 145, 8217: 146, 8220: 147, 8221: 148, 8226: 149,
    8211: 150, 8212: 151, 732: 152, 8482: 153, 353: 154, 8250: 155,
    339: 156, 382: 158, 376: 159
  };

  function pdfHex(value) {
    let hex = '';
    for (const char of String(value == null ? '' : value)) {
      const code = char.codePointAt(0);
      const byte = code >= 32 && code <= 126 ? code
        : code >= 160 && code <= 255 ? code
        : EXTRA[code] === undefined ? 63 : EXTRA[code];
      hex += byte.toString(16).toUpperCase().padStart(2, '0');
    }
    return '<' + hex + '>';
  }

  function rgb(c) { return c.map(x => x.toFixed(3)).join(' '); }
  function num(n) { return Number(n).toFixed(2); }

  const measureContext = typeof document !== 'undefined'
    ? document.createElement('canvas').getContext('2d') : null;
  function measuredWidth(text, size, bold) {
    if (!measureContext) return text.length * size * 0.51;
    measureContext.font = (bold ? 'bold ' : '') + size + 'px Helvetica, Arial, sans-serif';
    return measureContext.measureText(text).width;
  }

  // Respect user-entered line breaks, and handle long words without clipping.
  function wrapText(value, width, size, bold) {
    const paragraphs = String(value == null ? '' : value).replace(/\r\n?/g, '\n').split('\n');
    const result = [];
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) { result.push(''); continue; }
      let current = '';
      const words = paragraph.trim().split(/\s+/);
      for (let word of words) {
        const candidate = current ? current + ' ' + word : word;
        if (measuredWidth(candidate, size, bold) <= width) { current = candidate; continue; }
        if (current) { result.push(current); current = ''; }
        while (word && measuredWidth(word, size, bold) > width) {
          let cut = 1;
          while (cut < word.length && measuredWidth(word.slice(0, cut + 1), size, bold) <= width) cut++;
          result.push(word.slice(0, cut));
          word = word.slice(cut);
        }
        current = word;
      }
      if (current) result.push(current);
    }
    return result.length ? result : [''];
  }

  function makePdf(input) {
    if (!input || !Array.isArray(input.actions)) throw new Error('No action-plan data supplied.');
    const selected = input.actions.filter(a => a && a.status && a.status !== 'Not selected');
    if (!selected.length) throw new Error('Please select at least one action before downloading.');

    const pages = [];
    let page;
    function rect(x, y, w, h, color) {
      page.commands.push(rgb(color) + ' rg ' + [x, y, w, h].map(num).join(' ') + ' re f');
    }
    function text(value, x, y, size, bold, color) {
      const font = bold ? 'F2' : 'F1';
      page.commands.push('BT /' + font + ' ' + num(size) + ' Tf ' + rgb(color) + ' rg 1 0 0 1 ' + num(x) + ' ' + num(y) + ' Tm ' + pdfHex(value) + ' Tj ET');
    }
    function newPage(first) {
      page = {commands: [], y: first ? 678 : 757};
      pages.push(page);
      rect(0, PAGE_HEIGHT - 10, PAGE_WIDTH, 10, NAVY);
      text('CHAMBERS IRELAND', LEFT, PAGE_HEIGHT - 40, 11, true, NAVY);
      rect(LEFT, PAGE_HEIGHT - 53, TEXT_WIDTH, 2, GOLD);
      if (first) {
        text('Business Sustainability', LEFT, 747, 19, true, NAVY);
        text('Action Plan', LEFT, 724, 19, true, NAVY);
        text('Selected actions from the SDG Toolkit for Business', LEFT, 698, 10, false, MUTED);
      }
    }
    function ensureRoom(height) { if (page.y - height < 67) newPage(false); }
    function write(value, options) {
      const opt = options || {};
      const size = opt.size || 10;
      const line = opt.line || size * 1.40;
      const indent = opt.indent || 0;
      const color = opt.color || BODY;
      const content = String(value == null ? '' : value);
      for (const lineText of wrapText(content, TEXT_WIDTH - indent, size, !!opt.bold)) {
        ensureRoom(line);
        if (lineText) text(lineText, LEFT + indent, page.y, size, !!opt.bold, color);
        page.y -= line;
      }
      page.y -= opt.after || 0;
    }
    function divider() {
      ensureRoom(12);
      rect(LEFT, page.y - 3, TEXT_WIDTH, 0.7, [0.83, 0.87, 0.91]);
      page.y -= 13;
    }

    newPage(true);
    write('Organisation: ' + (input.organisation || 'Not provided'), {size: 10.8, bold: true, color: NAVY, after: 5});
    write('Prepared: ' + new Date().toLocaleDateString('en-IE') + '    |    Selected actions: ' + selected.length, {size: 9.3, color: MUTED, after: 13});

    let actionNumber = 0;
    for (const status of ['Considering', 'To do', 'In progress', 'Done']) {
      const matching = selected.filter(a => a.status === status);
      if (!matching.length) continue;
      ensureRoom(72);
      rect(LEFT, page.y - 8, TEXT_WIDTH, 26, SOFT);
      text(status.toUpperCase() + '  (' + matching.length + ')', LEFT + 10, page.y, 11.2, true, NAVY);
      page.y -= 41;

      for (const action of matching) {
        actionNumber++;
        ensureRoom(60);
        write(actionNumber + '. ' + (action.title || 'Untitled action'), {size: 11.3, bold: true, color: NAVY, after: 4});
        if (action.description) write(action.description, {size: 9.3, color: MUTED, after: 4});
        write('Status: ' + status, {size: 9.3, bold: true});
        write('Category: ' + (action.category || 'Not specified'), {size: 9.3});
        write('Linked SDGs: ' + (Array.isArray(action.sdgs) ? action.sdgs.map(n => 'SDG ' + n).join(', ') : 'Not specified'), {size: 9.3});
        write('Owner: ' + (action.owner || 'Not assigned'), {size: 9.3});
        write('Target date: ' + (action.targetDate || 'Not set'), {size: 9.3});
        write('Notes / evidence: ' + (action.notes || 'None recorded'), {size: 9.3, after: 7});
        divider();
      }
      page.y -= 4;
    }

    // A stable footer on every page, including a page count.
    pages.forEach((p, i) => {
      page = p;
      rect(LEFT, 49, TEXT_WIDTH, 0.8, GOLD);
      text('Chambers Ireland | SDG Toolkit for Business', LEFT, 34, 8, false, MUTED);
      text('Page ' + (i + 1) + ' of ' + pages.length, RIGHT - 74, 34, 8, false, MUTED);
    });

    const objects = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = '<< /Type /Pages /Kids [' + pages.map((_, i) => (6 + 2 * i) + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>';
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    pages.forEach((p, i) => {
      const stream = p.commands.join('\n') + '\n';
      objects[5 + i * 2] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream';
      objects[6 + i * 2] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE_WIDTH + ' ' + PAGE_HEIGHT + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (5 + i * 2) + ' 0 R >>';
    });

    // PDF objects use ASCII only; visible text is Windows-1252 in hex strings.
    let output = '%PDF-1.4\n';
    const offsets = [0];
    for (let i = 1; i < objects.length; i++) {
      offsets[i] = output.length;
      output += i + ' 0 obj\n' + objects[i] + '\nendobj\n';
    }
    const xref = output.length;
    output += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
    for (let i = 1; i < objects.length; i++) {
      output += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    output += 'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    return new Blob([output], {type: 'application/pdf'});
  }

  function download(input) {
    const blob = makePdf(input);
    const safeName = String(input.organisation || 'business')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'business';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'business-sustainability-action-plan-' + safeName + '.pdf';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  global.SDGActionPlanPDF = Object.freeze({makePdf, download});
})(window);
