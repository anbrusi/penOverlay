
export function attachPenOverlay(params) {
    let penOverlay = new PenOverlay(params);
}

class PenOverlay {
    /**
     * This is the div holding the wrapped document
     */
    parent = undefined;
    /**
     * The background color of penov-main div
     */
    backgroundColor = '#DDDDDD';
    /**
     * Width of the 'main' div 'penov-main'
     */
    mainWidth = '21cm'; // A4
    /**
     * Can be overriden if 'penWidth' is set in 'params' of the constructor
     */
    penWidth = 1;
    /**
     * Can be overriden if 'penColor' is set in 'params' of the constructor
     */
    penColor = '#FF4444';
    /**
     * Can be overriden if 'stepType' is set in 'params' of the constructor
     * Allowed stepTypes are 'L' for linear and 'B' fpor Bezier
     */
    stepType = 'B';
    /**
     * Minimal square distance between two registered points
     */
    minDist2 = 10;
    /**
     * The penov-main div
     */
    main = undefined;
    /**
     * The div holding the raw document, which will be corrected
     */
    raw = undefined;
    /**
     * margin-left of 'penov-raw'
     */
    rawLeft = '0px';
    /**
     * margin-right of 'penov-raw'
     */
    rawRight = '40%';
    /**
     * Distance between lines in 'penov-raw'
     */
    lineHeight = 'normal';
    /**
     * The canvas absolutely positioned on top of 'penov-main'
     */
    canvas = undefined;
    /**
     * 2d context of canvas
     */
    ctx = undefined;
    /**
     * Array of stroke segnments
     */
    segmentArray = [];
    /**
     * The index in this.segmentArray of the current segment
     */
    currSegment = undefined;
    /**
     * true iff the pointer is down and drawing
     */
    pointerDown = false;
    /**
     * The fraction of secant cector to be used to compute bezier control points
     */
    bezCtrl = 0.3;
    /**
     * The method used for a drawing step, can be lineTo(index) or bezTo(index)
     */
    drawStep = undefined;

    constructor(params) {
        // Decode parameters
        let parameters = JSON.parse(params);
        this.parent = document.getElementById(parameters['parentid']);
        if (parameters['backgroundColor']) {
            this.backgroundColor = parameter['backgroundColor'];
        }
        if (parameters['mainWidth']) {
            this.mainWidth = parameter['mainWidth'];
        }
        if (parameters['penWidh']) {
            this.penWidth = parameter['penWidth'];
        }
        if (parameters['penColor']) {
            this.penColor = parameters['penColor'];
        }
        if (parameters['stepType']) {
            this.stepType = parameters['stepType'];
        }
        if (parameters['minDist2']) {
            this.minDist2 = parameters['minDist2'];
        }
        if (parameters['rawLeft']) {
            this.rawLeft = parameters['rawLeft'];
        }
        if (parameters['rawRight']) {
            this.rawRight = parameters['rawRight'];
        }
        if (parameters['lineHeight']) {
            this.lineHeight = parameters['lineHeight'];
        }
        if (parameters['bezCtrl']) {
            this.bezCtrl = parameters['bezCtrl'];
        }
        // Set penov-main properties
        this.main = document.getElementById('penov-main');
        this.main.style['background-color'] = this.backgroundColor;
        this.main.style['touch-action'] = 'none'; 
        this.main.style.width = this.mainWidth;
        this.main.style.overflow = 'hidden';
        this.main.style.position = 'relative'; // Set relative position in order to place its child canvas absolutely
        // Set raw properties
        this.raw = document.getElementById('penov-raw');
        this.raw.style['margin-left'] = this.rawLeft;
        this.raw.style['margin-right'] = this.rawRight;
        this.raw.style['line-height'] = this.lineHeight;
        // Prepare canvas. The position is absolute and set to cover 'penov-main'
        this.canvas = document.getElementById('penov-canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = 0;
        // Define the drawing step, depending on the required interpolation
        if (this.stepType == 'L') {
            this.drawStep = this.lineTo;
        } else if (this.stepType == 'B') {
            this.drawStep = this.bezTo;
        }
        // Replace the store buttons, i.e. all buttons with name 'penov-store'
        this.replaceStoreButtons();
        window.addEventListener('load', this.boundLoadH); // Adjusts dimension after having loaded the images and sets this.ctx  
        // Add the pen listeners
        this.canvas.addEventListener('pointerdown', this.boundDownH);
        this.canvas.addEventListener('pointermove', this.boundMoveH);
        this.canvas.addEventListener('pointerup', this.boundUpH);
    }
    /**
     * Returns the position of the event in canvas coordinates as an object with properties 'x' and 'y'
     * 
     * @param {object} event 
     */
    canvasPos(event) {
        let rect = this.canvas.getBoundingClientRect();
        return {
            x: event.pageX - rect.left - window.scrollX,
            y: event.pageY - rect.top - window.scrollY
        }
    }
    newSegment() {
        let segment = {
            width: this.penWidth,
            color: this.penColor,
            pts: []
        }
        this.segmentArray.push(segment);
        this.currSegment = this.segmentArray.length - 1;
    }
    newPoint(pos) {
        this.segmentArray[this.currSegment].pts.push(pos);
    }
    pointPos(index) {
        return this.segmentArray[this.currSegment].pts[index];
    }
    nrPoints() {
        return this.segmentArray[this.currSegment].pts.length;
    }
    vector(p1, p2) {
        return {
            x: p2.x - p1.x,
            y: p2.y - p1.y
        }
    }
    norm2(v) {
        return v.x * v.x + v.y * v.y;
    }
    /**
     * Draws a line from the current canvas position to the point with index 'index' in the current segment.
     * 
     * @param {integer} pos 
     */
    lineTo(index) {
        // console.log(pos);
        let pos = this.pointPos(index);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
    }
    /**
     * Draws a bezier curve from the current canvas position to the point with index 'index' in the current segment.
     * This function uses points with indices 'index - 2' and 'index' to compute the tangent in 'index - 1' and
     * 'index - 1' and 'index + 1' to compute the tangent in 'index'.
     * If used dynamically it cannot reach the last known poin, but only the before last.
     * 4 points must be known to use this functio
     * 
     * @param {integer} index 
     */
    bezTo(index) {
        let p1 = this.pointPos(index - 2);
        let p2 = this.pointPos(index - 1);
        let p3 = this.pointPos(index);
        let p4 = this.pointPos(index + 1);
        let v1 = this.vector(p1, p3); // Direction of tangent in p2
        let v2 = this.vector(p4, p2); // Direction of tangent in p3
        // Compute the control points on the tangents
        let cp1x = p2.x + this.bezCtrl * v1.x;
        let cp1y = p2.y + this.bezCtrl * v1.y;
        let cp2x = p3.x + this.bezCtrl * v2.x;
        let cp2y = p3.y + this.bezCtrl * v2.y;
        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y);
        this.ctx.stroke();
    }
    /**
     * Draws from the current canvas position to the before last point
     */
    draw() {
        let nr = this.nrPoints()
        if (nr < 4) {
            this.lineTo(nr - 2);
        } else {
            // From this number of points on, we are free to use bezier curves
            this.drawStep(nr - 2);
        }
    }
    replaceStoreButtons() {
        let submitButtons = document.getElementsByName('penov-store');
        for (let submitButton of submitButtons) {
            // Create the replacement
            let replacement = document.createElement('input');
            replacement.name = 'penov-store';
            replacement.type = 'button';
            replacement.className = 'button';
            replacement.value = submitButton.value;
            // Add the click handler
            replacement.addEventListener('click', this.boundStoreH);
            // Execute the replacement
            submitButton.replaceWith(replacement);
        }
    }

    // Event handlers
    // ==============
    loadH(event) {
        // It is essential to writethe attribute of canvas, not the css style
        // Equally it is necessary to read clientWidth and clientHeight and not style values
        this.canvas.width = this.main.clientWidth;
        this.canvas.height = this.main.clientHeight;
        this.ctx = this.canvas.getContext('2d');
    }
    boundLoadH = this.loadH.bind(this);
    downH(event) {
        event.preventDefault();
        this.canvas.style.cursor = 'crosshair';
        let pos = this.canvasPos(event);
        this.newSegment();
        this.newPoint(pos);
        this.pointerDown = true;
        this.ctx.strokeStyle = this.segmentArray[this.currSegment].color;
        this.ctx.lineWidth = this.segmentArray[this.currSegment].width;
        console.log(this.ctx);
        this.ctx.moveTo(pos.x, pos.y);
    }
    boundDownH = this.downH.bind(this);
    moveH(event) {
        if (this.pointerDown) {
            event.preventDefault();
            let pos = this.canvasPos(event);
            let lastPos = this.pointPos(this.nrPoints() - 1);
            let d2 = this.norm2(this.vector(lastPos, pos));
            if (d2 > this.minDist2) {
                this.newPoint(pos);
                this.draw();
            }
        }
    }
    boundMoveH = this.moveH.bind(this);
    upH(event) {
        event.preventDefault();
        this.canvas.style.cursor = 'default';
        this.pointerDown = false;
        // Connect the very last point. This cannot be done with a bezier curve
        let nr = this.nrPoints();
        this.lineTo(nr - 1);
    }
    boundUpH = this.upH.bind(this);
    storeH(event) {
        // Store the segment array in JSON format
        let data = JSON.stringify(this.segmentArray);
        this.canvas.setAttribute('data-penov', data);
        // Save the overlayed document as a hidden POST variable in JSON format
        let hidden = document.createElement('input');
        hidden.name = 'penov-document';
        hidden.type = 'hidden';
        hidden.value = JSON.stringify(this.parent.innerHTML);
        // Add a second hidden POST with the original name
        let hidden2 = document.createElement('input');
        hidden2.name = 'penov-store';
        hidden2.type = 'hidden';
        hidden2.value = 'penov-store';
        // Submit the form
        let form = event.target.form;
        form.appendChild(hidden);
        form.appendChild(hidden2);
        form.submit();
    }
    boundStoreH = this.storeH.bind(this);
}