function getCarPositionInfo(positionInfoArray) {
	var positionInfo = {}
	
	for(var i = 0; i < positionInfoArray.length; i++) {
		
	}

	return positionInfo;
}

function Car(data) {
	this.name = data.name;
	this.color = data.color;
	
	this.angle = null;
	this.piecePosition = null;
}

Car.prototype.updateCarPosition = function(positionInfoArray) {
  var positionInfo = getCarPositionInfo(positionInfoArray);
  
};

module.exports = Car;