const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertHundreds(n) {
  if (n === 0) return '';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertHundreds(n % 100) : '');
}

export function amountInWords(amount) {
  const num = Math.round(parseFloat(amount || 0));
  if (num === 0) return 'Zero Rupees Only';
  let words = '';
  if (num >= 10000000) words += convertHundreds(Math.floor(num / 10000000)) + ' Crore ';
  if (num % 10000000 >= 100000) words += convertHundreds(Math.floor((num % 10000000) / 100000)) + ' Lakh ';
  if (num % 100000 >= 1000) words += convertHundreds(Math.floor((num % 100000) / 1000)) + ' Thousand ';
  if (num % 1000 > 0) words += convertHundreds(num % 1000) + ' ';
  return 'Rupees ' + words.trim() + ' Only';
}
