var Car = require('./car.js');

function Driver() {
}

Driver.prototype.drive = function(car) {
	var currentPiece = car.currentPiece;
    
    if (currentPiece.type == "S") {
    	return this.driveForStraight(car);
    } else if (currentPiece.type == "B") {
    	return this.driveForBend(car);
    } else {
    	return 1;
    }
}

Driver.prototype.driveForStraight = function(car) {
    var distanceToBend = car.distanceToBend();
    var currentSpeed = car.speed();
    
    // Why?
    if (distanceToBend > Math.pow(currentSpeed, 2)) {
    	return 1.0;
    } else if (currentSpeed < 7.5) {
    	// Why?
    	return 3.0/currentSpeed;
    }
    
    return 0.0;
}

Driver.prototype.driveForBend = function(car) {
    var currentSpeed = car.speed();
    var currentAcc = car.acceleration;

	// Why?
	if (currentSpeed < 7) {
    	if (currentAcc < 0 || currentSpeed < 6.5)
        	return 1.0;
        else
            return 0.0;
	} else if (currentAcc > 0) {
		// Why?
		return (1.7/currentSpeed);	
	}
    
	return 1.0;
}

module.exports = Driver;