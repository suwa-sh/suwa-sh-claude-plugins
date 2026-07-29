
class AnonymousSchema_1 {
  private _loanId: string;
  private _userId: string;
  private _userName: string;
  private _userEmail: string;
  private _bookTitle: string;
  private _dueDate: string;
  private _overdueDays: number;
  private _additionalProperties?: Map<string, any>;

  constructor(input: {
    loanId: string,
    userId: string,
    userName: string,
    userEmail: string,
    bookTitle: string,
    dueDate: string,
    overdueDays: number,
    additionalProperties?: Map<string, any>,
  }) {
    this._loanId = input.loanId;
    this._userId = input.userId;
    this._userName = input.userName;
    this._userEmail = input.userEmail;
    this._bookTitle = input.bookTitle;
    this._dueDate = input.dueDate;
    this._overdueDays = input.overdueDays;
    this._additionalProperties = input.additionalProperties;
  }

  get loanId(): string { return this._loanId; }
  set loanId(loanId: string) { this._loanId = loanId; }

  get userId(): string { return this._userId; }
  set userId(userId: string) { this._userId = userId; }

  get userName(): string { return this._userName; }
  set userName(userName: string) { this._userName = userName; }

  get userEmail(): string { return this._userEmail; }
  set userEmail(userEmail: string) { this._userEmail = userEmail; }

  get bookTitle(): string { return this._bookTitle; }
  set bookTitle(bookTitle: string) { this._bookTitle = bookTitle; }

  get dueDate(): string { return this._dueDate; }
  set dueDate(dueDate: string) { this._dueDate = dueDate; }

  get overdueDays(): number { return this._overdueDays; }
  set overdueDays(overdueDays: number) { this._overdueDays = overdueDays; }

  get additionalProperties(): Map<string, any> | undefined { return this._additionalProperties; }
  set additionalProperties(additionalProperties: Map<string, any> | undefined) { this._additionalProperties = additionalProperties; }
}
export default AnonymousSchema_1;
