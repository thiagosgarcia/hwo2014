function getPieceType(data) {
  // S for Straight
  if(data.length !== undefined) return "S";

  // B for Bend
  if(data.radius !== undefined) return "B";

  return "";
}

function Piece(data) {
  this.type = getPieceType(data);

  this.length = data.length;
  this.radius = data.radius;
  this.angle = data.angle;

  this.switch = !!data.switch;
}

module.exports = Piece;
