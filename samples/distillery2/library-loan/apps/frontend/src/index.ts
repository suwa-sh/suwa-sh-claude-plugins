// frontend ティアのエントリ。画面の入口関数と画面コンポーネントを公開する
export {
  API_BASE_URL,
  type ApiOptions,
  type LoanCheckoutInput,
  registerLoan,
} from './api-client/loan-api';
export {
  type LoanCheckoutField,
  type LoanCheckoutView,
  submitLoanCheckout,
  UNEXPECTED_ERROR_DETAIL,
  UNEXPECTED_ERROR_TITLE,
} from './state/loan-checkout';
export {
  LOAN_CHECKOUT_ROUTE,
  LoanCheckoutPage,
  type LoanCheckoutPageProps,
  LoanCheckoutScreen,
  type LoanCheckoutScreenProps,
} from './view/LoanCheckoutPage';
