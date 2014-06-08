function TurboAI(driver) {
    this.car = driver.car;
}

TurboAI.prototype.determineTurboUse = function() {
    var car = this.car;
    var currentPiece = car.currentPiece;
    var currentAcc = this.car.acceleration;

    // If the car is breaking (acc <= 0.0), the turbo will not be optimized
    // Check if the car angle is low enough to be safe to use the turbo
    if(currentAcc <= 0.0 || Math.abs(car.angle) > 30.0)
        return false;

    if(car.inLastStraight())
        return true;

    // If the currentPiece the car is on is a Bend, we have to check if the car is on its exit;
    if(currentPiece.type == "B") {
        return false;
        /*
        var bendLength = currentPiece.bendLength(car.lane);

        if(car.distanceInCurrentBend() < (bendLength * 0.75))
            return false;
        */
    }

    var distanceToBend = car.distanceToBend();
    var distanceInTurbo = 500.0; //(2 * currentAcc * car.turboFactor * Math.pow(car.turboDurationTicks, 2));

    // If the distance to the next bend is greater than the distance the car will travel in Turbo, turbo away!
    return distanceToBend > distanceInTurbo;
};

module.exports = TurboAI;