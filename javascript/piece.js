function getPieceType(data) {
  // S for Straight
  if(data.length !== undefined) return "S";

  // B for Bend
  if(data.radius !== undefined) return "B";

  return "";
}

function getAngleInRadian(angle){
    return angle * Math.PI / 180.0;
}

function Piece(data, index) {
  this.type = getPieceType(data);
  this.index = index;

  this.length = data.length;
  this.radius = data.radius;
  this.angle = data.angle;
  this.angleInRadians = getAngleInRadian(this.angle);

  this.switch = !!data.switch;
}

Piece.prototype.lengthInLane = function(lane) {
	if (this.type == "B") {
		var angleInRadians = (Math.PI * this.angle) / 180;
		var distanceToCenter = this.radius + this.laneDistanceFromCenter(lane);
		
		return Math.abs(angleInRadians * distanceToCenter);
	} else {
		return this.length;
	}
}

// this function is for Bend pieces only;
Piece.prototype.laneDistanceFromCenter = function(lane) {
	var distanceFromCenter = lane.distanceFromCenter;

	// Multiplying factor to determine the correct lane distance to the center of a bend;
	// left is positive, don't change, right is negative, to invert the lane distanceFromCenter;
	var directionMultiplier = (this.angle > 0) ? -1 : 1;
	
    return distanceFromCenter * directionMultiplier;
}

module.exports = Piece;
