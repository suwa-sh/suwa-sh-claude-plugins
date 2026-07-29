
class AnonymousSchema_9 {
  private _reservationId: string;
  private _userId: string;
  private _userName: string;
  private _userEmail: string;
  private _bookTitle: string;
  private _bookId: string;
  private _additionalProperties?: Map<string, any>;

  constructor(input: {
    reservationId: string,
    userId: string,
    userName: string,
    userEmail: string,
    bookTitle: string,
    bookId: string,
    additionalProperties?: Map<string, any>,
  }) {
    this._reservationId = input.reservationId;
    this._userId = input.userId;
    this._userName = input.userName;
    this._userEmail = input.userEmail;
    this._bookTitle = input.bookTitle;
    this._bookId = input.bookId;
    this._additionalProperties = input.additionalProperties;
  }

  get reservationId(): string { return this._reservationId; }
  set reservationId(reservationId: string) { this._reservationId = reservationId; }

  get userId(): string { return this._userId; }
  set userId(userId: string) { this._userId = userId; }

  get userName(): string { return this._userName; }
  set userName(userName: string) { this._userName = userName; }

  get userEmail(): string { return this._userEmail; }
  set userEmail(userEmail: string) { this._userEmail = userEmail; }

  get bookTitle(): string { return this._bookTitle; }
  set bookTitle(bookTitle: string) { this._bookTitle = bookTitle; }

  get bookId(): string { return this._bookId; }
  set bookId(bookId: string) { this._bookId = bookId; }

  get additionalProperties(): Map<string, any> | undefined { return this._additionalProperties; }
  set additionalProperties(additionalProperties: Map<string, any> | undefined) { this._additionalProperties = additionalProperties; }
}
export default AnonymousSchema_9;
