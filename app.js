(() => {
  'use strict';

  const STORAGE_KEY = 'on-tap-custom-banks-v1';
  const BUILT_IN_BANK = window.QUIZ_DATA;
  const EXTRA_BUILT_IN_BANKS = window.QUIZ_EXTRA_BANKS;
  const elements = {
    bankSelect: document.querySelector('#bank-select'),
    bankTitle: document.querySelector('#bank-title'),
    categoryTag: document.querySelector('#category-tag'),
    questionNumber: document.querySelector('#question-number'),
    questionTotal: document.querySelector('#question-total'),
    questionList: document.querySelector('#question-list'),
    resultSummary: document.querySelector('#result-summary'),
    progress: document.querySelector('#progress-value'),
    progressTrack: document.querySelector('.progress-track'),
    keyboardHint: document.querySelector('.keyboard-hint'),
    finish: document.querySelector('#finish-button'),
    instantToggle: document.querySelector('#instant-toggle'),
    manageButton: document.querySelector('#manage-banks'),
    dialog: document.querySelector('#manage-dialog'),
    fileInput: document.querySelector('#file-input'),
    bankList: document.querySelector('#bank-list'),
    downloadTemplate: document.querySelector('#download-template'),
    toast: document.querySelector('#toast')
  };

  let customBanks = loadCustomBanks();
  let currentBankId = BUILT_IN_BANK.id;
  let answers = [];
  let finished = false;
  let toastTimer;
  let banks = [];

  function loadCustomBanks() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const value = JSON.parse(saved);
      if (!Array.isArray(value) || value.some((bank) => !isValidBank(bank))) {
        throw new Error('Dữ liệu bộ câu hỏi đã lưu không đúng định dạng.');
      }
      return value;
    } catch (error) {
      console.error('Không thể đọc bộ câu hỏi đã lưu:', error);
      showToast('Không đọc được bộ câu hỏi đã lưu. Hãy thử tải lại hoặc nhập lại tệp.', true);
      return [];
    }
  }

  function saveCustomBanks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customBanks));
    } catch (error) {
      console.error('Không thể lưu bộ câu hỏi:', error);
      showToast('Không thể lưu vào trình duyệt. Hãy kiểm tra dung lượng lưu trữ.', true);
      return false;
    }
    return true;
  }

  function isValidBank(bank) {
    return Boolean(
      bank &&
      typeof bank.id === 'string' &&
      typeof bank.title === 'string' &&
      Array.isArray(bank.questions) &&
      bank.questions.length > 0 &&
      bank.questions.every((question) =>
        question &&
        typeof question.question === 'string' &&
        question.question.trim() &&
        question.options &&
        typeof question.options === 'object' &&
        !Array.isArray(question.options) &&
        Object.keys(question.options).length >= 2 &&
        Object.keys(question.options).length <= 6 &&
        Object.keys(question.options).every((key) =>
          /^[A-F]$/.test(key) && typeof question.options[key] === 'string' && question.options[key].trim()
        ) &&
        Object.hasOwn(question.options, question.answer) &&
        (question.explanation === undefined || typeof question.explanation === 'string')
      )
    );
  }

  function makeBanks() {
    banks = [BUILT_IN_BANK, ...EXTRA_BUILT_IN_BANKS, ...customBanks];
    if (!banks.some((bank) => bank.id === currentBankId)) currentBankId = BUILT_IN_BANK.id;
    elements.bankSelect.replaceChildren();
    banks.forEach((bank) => {
      const option = document.createElement('option');
      option.value = bank.id;
      option.textContent = `${bank.title} · ${bank.questions.length} câu`;
      option.selected = bank.id === currentBankId;
      elements.bankSelect.append(option);
    });
    renderBankList();
  }

  function getCurrentBank() {
    return banks.find((bank) => bank.id === currentBankId) || BUILT_IN_BANK;
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle('error', isError);
    elements.toast.classList.add('visible');
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('visible'), 3600);
  }

  function updateProgress() {
    const bank = getCurrentBank();
    const answeredCount = answers.filter((answer) => answer !== undefined).length;
    const percent = (answeredCount / bank.questions.length) * 100;

    elements.questionNumber.textContent = String(answeredCount);
    elements.questionTotal.textContent = String(bank.questions.length);
    elements.progress.style.width = `${percent}%`;
    elements.progressTrack.setAttribute('aria-valuenow', String(Math.round(percent)));
  }

  function renderQuestionItem(question, index) {
    const item = document.createElement('article');
    item.className = 'question-item';
    const headingRow = document.createElement('div');
    headingRow.className = 'question-item-heading';
    const kicker = document.createElement('p');
    kicker.className = 'question-kicker';
    kicker.textContent = `CÂU HỎI ${String(index + 1).padStart(2, '0')}`;
    const category = document.createElement('span');
    category.className = 'category-tag';
    category.textContent = question.category || 'ÔN TẬP TỔNG HỢP';
    headingRow.append(kicker, category);

    const title = document.createElement('h3');
    title.className = 'question-title';
    title.textContent = question.question;
    const answerList = document.createElement('div');
    answerList.className = 'answer-list';
    const feedback = document.createElement('div');
    feedback.className = 'feedback';
    feedback.setAttribute('aria-live', 'polite');
    feedback.hidden = true;

    Object.entries(question.options).forEach(([letter, text]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer-option';
      button.dataset.answer = letter;
      const badge = document.createElement('span');
      badge.className = 'answer-letter';
      badge.textContent = letter;
      const label = document.createElement('span');
      label.textContent = text;
      button.append(badge, label);
      button.addEventListener('click', () => selectAnswer(index, letter));
      answerList.append(button);
    });

    item.append(headingRow, title, answerList, feedback);
    elements.questionList.append(item);
    updateQuestionDisplay(index);
  }

  function updateQuestionDisplay(index) {
    const bank = getCurrentBank();
    const question = bank.questions[index];
    const selected = answers[index];
    const shouldReveal = finished || (elements.instantToggle.checked && selected !== undefined);
    const item = elements.questionList.children[index];
    if (!item) return;

    item.querySelectorAll('.answer-option').forEach((button) => {
      const letter = button.dataset.answer;
      button.disabled = finished;
      button.setAttribute('aria-pressed', String(selected === letter));
      button.classList.toggle('selected', selected === letter);
      button.classList.toggle('correct', shouldReveal && letter === question.answer);
      button.classList.toggle('incorrect', shouldReveal && selected === letter && letter !== question.answer);
    });

    const feedback = item.querySelector('.feedback');
    feedback.hidden = !shouldReveal;
    feedback.classList.toggle('is-wrong', selected !== undefined && selected !== question.answer);
    feedback.replaceChildren();
    if (shouldReveal) {
      const title = document.createElement('strong');
      title.textContent = selected === undefined
        ? `Đáp án đúng: ${question.answer}.`
        : selected === question.answer ? 'Chính xác!' : `Chưa đúng — đáp án là ${question.answer}.`;
      feedback.append(title);
      if (question.explanation) feedback.append(document.createTextNode(question.explanation));
    }
  }

  function renderQuiz() {
    const bank = getCurrentBank();
    elements.bankTitle.textContent = bank.title;
    elements.categoryTag.textContent = finished ? 'ĐÃ HOÀN THÀNH' : 'ÔN TẬP TỔNG HỢP';
    elements.questionList.replaceChildren();
    elements.resultSummary.hidden = !finished;
    elements.keyboardHint.textContent = finished
      ? 'Đáp án đúng đã được hiện bên dưới từng câu'
      : 'Chọn đáp án từng câu, rồi cuộn xuống';
    elements.finish.innerHTML = finished
      ? 'Làm lại <span aria-hidden="true">↻</span>'
      : 'Nộp bài &amp; xem điểm <span aria-hidden="true">✓</span>';
    bank.questions.forEach(renderQuestionItem);
    updateProgress();
  }

  function selectAnswer(index, letter) {
    if (finished) return;
    answers[index] = letter;
    updateQuestionDisplay(index);
    updateProgress();
  }

  function finishQuiz() {
    finished = true;
    const bank = getCurrentBank();
    const score = answers.reduce((total, answer, index) =>
      total + (answer === bank.questions[index].answer ? 1 : 0), 0);
    const answeredCount = answers.filter((answer) => answer !== undefined).length;

    elements.resultSummary.hidden = false;
    elements.resultSummary.textContent = `Bạn trả lời đúng ${score}/${bank.questions.length} câu (${answeredCount} câu đã chọn). Đáp án đúng được hiện bên dưới từng câu.`;
    renderQuiz();
    elements.categoryTag.textContent = score === bank.questions.length ? 'XUẤT SẮC!' : 'ĐÃ HOÀN THÀNH';
  }

  function restartQuiz() {
    answers = [];
    finished = false;
    renderQuiz();
    document.querySelector('.quiz-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  elements.finish.addEventListener('click', () => {
    if (finished) restartQuiz();
    else finishQuiz();
  });

  elements.bankSelect.addEventListener('change', () => {
    currentBankId = elements.bankSelect.value;
    restartQuiz();
  });

  elements.instantToggle.addEventListener('change', () => {
    getCurrentBank().questions.forEach((_, index) => updateQuestionDisplay(index));
  });
  elements.manageButton.addEventListener('click', () => elements.dialog.showModal());

  elements.fileInput.addEventListener('change', async () => {
    const file = elements.fileInput.files && elements.fileInput.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      const bank = normalizeBank(imported);
      if (!isValidBank(bank)) {
        throw new Error('Tệp không đúng mẫu. Kiểm tra tên bộ câu hỏi, lựa chọn và đáp án của từng câu.');
      }
      if (banks.some((item) => item.title.toLocaleLowerCase() === bank.title.toLocaleLowerCase())) {
        throw new Error('Đã có bộ câu hỏi cùng tên. Hãy đổi tên bộ mới rồi nhập lại.');
      }
      customBanks.push(bank);
      if (!saveCustomBanks()) {
        customBanks.pop();
        return;
      }
      currentBankId = bank.id;
      makeBanks();
      restartQuiz();
      elements.dialog.close();
      showToast(`Đã thêm “${bank.title}” với ${bank.questions.length} câu hỏi.`);
    } catch (error) {
      console.error('Không thể nhập bộ câu hỏi:', error);
      showToast(error instanceof SyntaxError ? 'Tệp JSON bị lỗi cú pháp. Hãy kiểm tra lại nội dung tệp.' : error.message, true);
    } finally {
      elements.fileInput.value = '';
    }
  });

  function normalizeBank(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Tệp JSON cần có đối tượng chứa title và questions.');
    }
    if (typeof input.title !== 'string' || !input.title.trim() || !Array.isArray(input.questions)) {
      throw new Error('Tệp cần có tên bộ câu hỏi (title) và danh sách câu hỏi (questions).');
    }
    return {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: input.title.trim(),
      questions: input.questions.map((question) => ({
        question: question && question.question,
        options: question && question.options,
        answer: question && typeof question.answer === 'string' ? question.answer.toUpperCase() : question && question.answer,
        explanation: question && question.explanation
      }))
    };
  }

  elements.downloadTemplate.addEventListener('click', () => {
    const template = {
      title: 'Bộ câu hỏi mẫu',
      questions: [{
        question: 'Thủ đô của Việt Nam là gì?',
        options: { A: 'Đà Nẵng', B: 'Hà Nội', C: 'Huế', D: 'Cần Thơ' },
        answer: 'B',
        explanation: 'Hà Nội là thủ đô của Việt Nam.'
      }]
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mau-bo-cau-hoi.json';
    link.click();
    URL.revokeObjectURL(url);
  });

  function renderBankList() {
    elements.bankList.replaceChildren();
    customBanks.forEach((bank) => {
      const row = document.createElement('div');
      row.className = 'bank-row';
      const details = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = bank.title;
      const count = document.createElement('small');
      count.textContent = `${bank.questions.length} câu hỏi`;
      details.append(title, count);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-bank';
      remove.textContent = 'Xóa';
      remove.setAttribute('aria-label', `Xóa bộ câu hỏi ${bank.title}`);
      remove.addEventListener('click', () => {
        customBanks = customBanks.filter((item) => item.id !== bank.id);
        if (!saveCustomBanks()) {
          customBanks.push(bank);
          return;
        }
        if (currentBankId === bank.id) {
          currentBankId = BUILT_IN_BANK.id;
          restartQuiz();
        }
        makeBanks();
        showToast(`Đã xóa “${bank.title}”.`);
      });
      row.append(details, remove);
      elements.bankList.append(row);
    });
  }

  if (
    !BUILT_IN_BANK ||
    !isValidBank(BUILT_IN_BANK) ||
    !Array.isArray(EXTRA_BUILT_IN_BANKS) ||
    EXTRA_BUILT_IN_BANKS.some((bank) => !isValidBank(bank))
  ) {
    showToast('Không tải được bộ câu hỏi ban đầu.', true);
    elements.finish.disabled = true;
  } else {
    makeBanks();
    renderQuiz();
  }
})();
