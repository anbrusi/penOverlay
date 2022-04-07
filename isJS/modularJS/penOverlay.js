
export function attachPenOverlay(params) {
    let penOverlay = new PenOverlay(params);
}

import {RubberBand} from './rubberBand.js';

const commandPanelHeight = 80; // Can be freely chosen, but conditions cpHeight
const commandPanelWidth = 230; // Must be chosen to suit colorCanvas, determined by cpSpace and cpRadius
/**
 * =========================================================
 * Command panel dimensions with respect to the color canvas
 * =========================================================
 */
const cpSpace = 10; 
const cpRadius = 13;
const cpHeight = 78; // This is an empiric value, which must suit commandPanelHeight
const cpUpperC = cpSpace + cpRadius;
const cpLowerC = 2 * cpSpace + 3 * cpRadius;
const cpLeftC = 2 * cpSpace + 2 * cpRadius;
const cpRightC = 3 * cpSpace + 4 * cpRadius;
const cpWidth = 4 * cpSpace + 5 * cpRadius;

const cpURcolor = '#00EE00'; // green
const cpLLcolor = '#0044DD'; // blue
const cpLRcolor = '#FFBB22'; // yellow
/**
 * PenOverlay works together with its counterpart in PHP.
 * It allows pen annotation of a document by allowing to write on a canvas placed over a HTML document.
 * The PHP part is responsible for the display of the document in a standardized way. If the document
 * is not already wrapped it must wrapped as follows:
 * 
 *      <!--penOverlay-->
 *      <div id="penov-main">
 *          <div id="penov-raw">
 *              HTML for te document
 *          </div>
 *          <canvas id="penov-canvas" data-penov=""></canvas>
 *      </div>
 *      <!--/penOverlay-->
 * 
 * The wrapped document must be placed inside a div with an id transmitted to JS.
 * The JS part (this script) is loaded in PHP as follows. 
 * $params is a json encoded associative array with many elements. Defaults are supplied by JS for
 * all parameters except the id of the containing div
 * 
 *      $params = array('parentid' => 'penov-parent');
 *      $jsonParams = json_encode($params);
 *      $html .= '<script type="module">';
 *      $html .=    'import {attachPenOverlay} from "./isJS/modularJS/penOverlay.js";';
 *      $html .=    'attachPenOverlay(\''.$jsonParams.'\');';
 *      $html .= '</script>';        
 * 
 * The PHP part supplies one or more buttons with the conventional neme 'penov-store' for storing the document
 * JS replaces these buttons with inputs of class 'button', whose action is to create two hidden POST
 * varaiables 'penov-store' and 'penov-document'. The values are 'penov-store' and HTML of the annotated
 * document. This is just the wrapped document with the data-penov attribute of canvas filled with
 * a JSON encoded version of the 'segmentArray'. 
 * The returned document can be loaded in the parent-div without any modification, as it is already wrapped.
 * If data-penov is not empty and this script is loaded, as described above, the annotation is rendered.
 */
class PenOverlay {
    /**
     * This is a div with id 'loadingIndicator' and class 'loadingIndicator' that is part
     * of the wrapping. It displays a spinning wheel in the left upper corner of this.main.
     * It is hidden, when the loadH finishes to draw on the canvas and shown again when
     * one of the replaced store buttons is clicked.
     */
    loadingIndicator = undefined;
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
    defaultPenColor = '#FF4444';
    /**
     * Current pen color and upper left color in the command panel
     * Is set to defaultPenColor in the constructor
     */
    penColor = undefined;
    /**
     * Can be overriden if 'stepType' is set in 'params' of the constructor
     * Allowed stepTypes are 'L' for linear and 'B' fpor Bezier
     */
    stepType = 'B';
    /**
     * Minimal square distance between two registered points
     */
    minDist2 = 20;
    /**
     * Pen data can be stored as point (type = 'points')
     * or bitmap (type = 'bitmap')
     */
    storageType = 'points';
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
     * Last position reached by the pen. Used to eliminate Points that are to close during pen motion.
     */
    lastPos = undefined;
    /**
     * p1, p2, p3, p4 are to store line or bezier points, when not all points are stored.
     * Only this.storageType = 'points' requires all points to be stored in this.segmentArray.
     * Other methods of storing canvas content require only 4 points to draw a bezier curve
     * from the current point, which is p2, to the endpoint, which is p3. 
     * p1 and p4 are needed to compute the control points.
     * 
     */
    p1 = undefined;
    p2 = undefined;
    p3 = undefined;
    p4 = undefined;
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
     * An absolutely positioned div for commands
     */
    commandDiv = undefined;
    /**
     * Images within the command div
     */
    penImage = undefined;
    markerImage = undefined;
    rubberImage = undefined;
    /**
     * One of the modes in which PenOverlay work.
     * Modes are: 'none', 'pen', 'marker', 'rubber'
     */
    commandMode = 'none';

    /**
     * ================================================================================================================
     * Parameter dependent functions. 
     * These functions are set by the constructor in order to avoid different cases within a function.
     * This way pecularities can be set once and for all at initialization instead of making distinctions at each usage
     * ================================================================================================================
     */

    /**
     * This method is called when a new Segment is started.
     * It is storage type dependendent. It can be newSegmentPts or newSegmentBm
     */
    newSegment = undefined;
    /**
     * This method is called, when a new point is added by pen motion.
     * It is storage type dependendent. It can be newPointPts or newPointBm
     */
    newPoint = undefined;
    /**
     * The method used to draw. It is storage type dependent, 
     * can be drawPts for storage type 'points' or drawBm for storage type 'bitmao'
     */
    draw = undefined;
    /**
     * The method is used for drawing one stroke, when a new point is added to the path.
     * It is not necessarily the last point in the segment, since due to the nature of bezier curves
     * the last connectable point is the before last. The last is needed for the tangent in the before last.
     * Can be drawToPts or drawToBm
     */
    drawTo = undefined;
    /**
     * The method used for a drawing step, can be drawStelLin or drawStepBez
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
        if (parameters['defaultPenColor']) {
            this.defaultPenColor = parameters['defaultPenColor'];
        }
        if (parameters['stepType']) {
            this.stepType = parameters['stepType'];
        }
        if (parameters['minDist2']) {
            this.minDist2 = parameters['minDist2'];
        }
        if (parameters['storageType']) {
            this.storageType = parameters['storageType'];
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
        this.penColor = this.defaultPenColor;
        this.loadingIndicator = document.getElementById('loadingIndicator');
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

        // Override the default storage type, if the document has a defined storage type
        let loadedStorageType = this.canvas.dataset.penovst;
        if (loadedStorageType) {
            this.storageType = loadedStorageType;
        }

        // Define the drawing type
        if (this.storageType == 'points') {
            this.draw = this.drawPts;
            this.drawTo = this.drawToPts;
            this.newSegment = this.newSegmentPts;
            this.newPoint = this.newPointPts;
        } else if (this.storageType == 'bitmap') {
            this.draw = this.drawBm;
            this.drawTo = this.drawToBm;
            this.newSegment = this.newSegmentBm;
            this.newPoint = this.newPointBm;
        } 
        // Define the drawing step, depending on the required interpolation
        if (this.stepType == 'L') {
            this.drawStep = this.drawStepLin;
        } else if (this.stepType == 'B') {
            this.drawStep = this.drawStepBez;
        }
        // Replace the store buttons, i.e. all buttons with name 'penov-store'
        this.replaceStoreButtons();
        window.addEventListener('load', this.boundLoadH); // Adjusts dimension after having loaded the images and sets this.ctx  
        // Add the pen listeners
        this.canvas.addEventListener('pointerdown', this.boundDownH);
        this.canvas.addEventListener('pointermove', this.boundMoveH);
        this.canvas.addEventListener('pointerup', this.boundUpH);

        // Instantiate a rubber band
        let rbParams = {
            parentid: this.main.id
        }
        // this.rubberBand = new RubberBand(rbParams);
    }
    /**
     * Draws a rectangele inn the color canvas of the command panel, using the current color
     * 
     * @param {obj} ctx 
     */
    showCurrentColor() {
        this.colorCtx.fillStyle = this.penColor;
        this.colorCtx.fillRect(cpSpace, cpSpace, cpRadius, cpLowerC + cpRadius - cpSpace);
    }
    buildColorCanvas() {
        this.colorCanvas = document.createElement('canvas');
        this.colorCanvas.width = cpWidth;
        this.colorCanvas.height = cpHeight;
        // Draw a rectangler with the default color
        this.colorCtx = this.colorCanvas.getContext('2d');
        // Draw the bar for the current color in the command panel
        this.showCurrentColor();
        // Default color circle
        this.colorCtx.fillStyle = this.defaultPenColor;
        this.colorCtx.beginPath();
        this.colorCtx.arc(cpLeftC, cpUpperC, cpRadius, 0, 2 * Math.PI);
        this.colorCtx.fill();
        // Green circle
        this.colorCtx.fillStyle = cpURcolor;
        this.colorCtx.beginPath();
        this.colorCtx.arc(cpRightC, cpUpperC, cpRadius, 0, 2 * Math.PI);
        this.colorCtx.fill();
        // Blue circle
        this.colorCtx.fillStyle = cpLLcolor;
        this.colorCtx.beginPath();
        this.colorCtx.arc(cpLeftC, cpLowerC, cpRadius, 0, 2 * Math.PI);
        this.colorCtx.fill();
        // Yellow circle
        this.colorCtx.fillStyle = cpLRcolor;
        this.colorCtx.beginPath();
        this.colorCtx.arc(cpRightC, cpLowerC, cpRadius, 0, 2 * Math.PI);
        this.colorCtx.fill();
    }
    /**
     * Sets up the command panel dynamically and inserts it at a fixed position in the FDOM
     */
    buildCommandPanel() {
        // Add a command div
        this.commandDiv = document.createElement('div');
        this.commandDiv.style.height = commandPanelHeight;
        this.commandDiv.style.width = commandPanelWidth;
        this.commandDiv.style.backgroundColor = 'FFFFFF';
        this.commandDiv.style.opacity = 0.8;
        this.commandDiv.style.border = '2px solid black';
        this.commandDiv.style.position = 'fixed';
        let coordinates = this.main.getBoundingClientRect();
        this.commandDiv.style.top = coordinates.top;
        // Pen image
        this.penImage = document.createElement('img');
        this.penImage.setAttribute('src', 'http://myprojects/isImg/penov_pen_idle.png');
        this.penImage.style.height = '80px';
        this.markerImage = document.createElement('img');
        this.markerImage.setAttribute('src', 'http://myprojects/isImg/penov_marker_idle.png');
        this.markerImage.style.height = '80px';
        this.rubberImage = document.createElement('img');
        this.rubberImage.setAttribute('src', 'http://myprojects/isImg/penov_rubber_idle.png');
        this.rubberImage.style.height = '80px';
        this.commandDiv.appendChild(this.penImage);
        this.commandDiv.appendChild(this.markerImage);
        this.commandDiv.appendChild(this.rubberImage);
        this.buildColorCanvas();
        this.commandDiv.appendChild(this.colorCanvas);
        this.main.appendChild(this.commandDiv);
        // Attatch click handlers to the images
        this.penImage.addEventListener('click', this.boundPenClickH);
        this.markerImage.addEventListener('click', this.boundMarkerClickH);
        this.rubberImage.addEventListener('click', this.boundrubberClickH);
        this.colorCanvas.addEventListener('click', this.boundCpClickH);
    }
    setMode(mode) {
        this.unsetMode(this.commandMode);
        this.commandMode = mode;
        switch (this.commandMode) {
            case 'pen':
                this.penImage.setAttribute('src', '../../isImg/penov_pen_active.png');
                break;
            case 'marker':
                this.markerImage.setAttribute('src', '../../isImg/penov_marker_active.png');
                break;
            case 'rubber':
                this.rubberImage.setAttribute('src', '../../isImg/penov_rubber_active.png');
                break;
        }
    }
    unsetMode(mode) {
        switch (this.commandMode) {
            case 'pen':
                this.penImage.setAttribute('src', '../../isImg/penov_pen_idle.png');
                break;
            case 'marker':
                this.markerImage.setAttribute('src', '../../isImg/penov_marker_idle.png');
                break;
            case 'rubber':
                this.rubberImage.setAttribute('src', '../../isImg/penov_rubber_idle.png');
                break;
        }
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
    colorCanvasPos(event) {        
        let rect = this.colorCanvas.getBoundingClientRect();
        return {
            x: event.pageX - rect.left - window.scrollX,
            y: event.pageY - rect.top - window.scrollY
        }
    }
    /**
     * Initiates temporary points used for drawing one stroke in the path
     * 
     * @param {object} p 
     */
    initTemporaryPts(p) {        
        this.p1 = p;
        this.p2 = undefined;
        this.p3 = undefined;
        this.p4 = undefined;
    }
    /**
     * This will be the metod this.newSegment() if this.storageType = 'points'
     * Initialises a new segment (a connected path with given style in the canvas)
     * 
     * @param {object} p 
     */
    newSegmentPts(p) {
        let segment = {
            width: this.penWidth,
            color: this.penColor,
            pts: []
        }
        this.segmentArray.push(segment);
        this.currSegment = this.segmentArray.length - 1;
        this.newPointPts(p);
        this.initTemporaryPts(p); // Initialize temporary points
    }
    /**
     * This will be the metod this.newSegment() if this.storageType = 'bitmap'
     * Initialises a new segment (a connected path with given style in the canvas)
     * 
     * @param {object} p 
     */
    newSegmentBm(p) {
        this.initTemporaryPts(p); // Initialize temporary points
    }
    newPointPts(pos) {
        this.segmentArray[this.currSegment].pts.push(pos);
    }
    newPointBm() {
        // intentionally empty
    }
    pointPos(index) {
        return this.segmentArray[this.currSegment].pts[index];
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
     * Draws a line from the current canvas position to the point with position pos
     * @param {integer} pos 
     */
    lineTo(pos) {
        // console.log(pos);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
    }
    /**
     * Joins points p2 and p3 with a bezier curve, using p1 and p4 to compute the control points
     * The tangent in p2 is parallel to the secant p1-p3 and the tangent in p3 is parallel to the secant p2-p4
     * 
     * @param {object} p1 
     * @param {object} p2 
     * @param {object} p3 
     * @param {object} p4 
     */
    bezier(p1, p2, p3, p4) {
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
        this.bezier(p1,p2,p3,p4);
    }
    drawToPts(p) {        
        this.newPoint(p);
        this.drawToBm(p);
    }
    /**
     * Draws the last stroke in a path from the current point to 'p'
     * 
     * @param {object} p 
     */
    drawToBm(p) {
        this.drawStep(p); // Either this.drawStepLin or this.drawStepBez
    }
    /**
     * Draws a bezier curve from the current point to the point BEFORE 'p'
     * 
     * this.p1 is set by pointerdown and shpuld always be present.
     * If this.p2 and this.p3 are present as well this.p4 becomes p
     * and a bezier curve is drawn from this.p2 to this.p3. 
     * this.p1 and this.p4 are used to compute the control points.
     * If this.p2 is present this.p3 becomes p and a line is drawn from this.p2 to this.p3
     * If this.p2 is missing this.p2 becomes p.
     * In any case the function completes the path up to the last point registered BEFORE p,
     * stores p for further use and updates the temporary points
     * 
     * Temporary points are updated
     * @param {object} p 
     */
    drawStepBez(p) {
        if (this.p3) {
            // We have 3 points and just got the 4th point p
            this.p4 = p;
            this.bezier(this.p1, this.p2, this.p3, this.p4); // After that the current point in the path is p3
            // Update the stored points
            this.p1 = this.p2;
            this.p2 = this.p3;
            this.p3 = this.p4;
            // The value of this.p4 does not matter any more. We could have set this.p4 = undefined;
        } else {
            if (this.p2) {
                // We have 2 points and just got the 3rd point p
                // We store it for further use and draw the path from 1 to 2
                this.p3 = p;
                this.lineTo(this.p2); // After that the current point in the path is p2
            } else {
                // We have 1 point and just got the 2nd point p
                // We store it for further use
                this.p2 = p;
            }
        }
    }
    /**
     * Draws a line to the point BEFORE 'p'.
     * 
     * @param {object} p 
     */
    drawStepLin(p) {
        if (this.p2) {
            this.p3 = p;
            this.lineTo(this.p2);
            this.p1 = this.p2;
            this.p2 = this.p3;
        } else {
            this.p2 = p;
        }
    }
    /**
     * Draws from the current canvas position to the before last point.
     * Uses the points stored in this.segmentArray. Applies only if all points are stored
     * i.e. for this.storageType == 'points'.
     * 
     * @param {integer} the total number of points
     */
    drawPts(nr) {
        if (nr < 4) {
            let pos = this.pointPos(nr - 2);
            this.lineTo(pos);
        } else {
            // From this number of points on, we are free to use bezier curves
            this.drawStep(nr - 2);
        }
    }
    /**
     * Draws stored point data to the canvas
     */
    renderDataPts() {
        this.segmentArray = JSON.parse(this.canvas.dataset.penov);
        for (let i = 0; i < this.segmentArray.length; i++) {
            this.currSegment = i;
            if (this.segmentArray[this.currSegment].pts.length > 2) {
                // Emulate pointerdown
                this.ctx.beginPath();          
                this.ctx.strokeStyle = this.segmentArray[this.currSegment].color;
                this.ctx.lineWidth = this.segmentArray[this.currSegment].width;
                this.ctx.lineJoin = 'round';
                this.ctx.lineCap = 'round';
                let pos = this.pointPos(0);
                this.ctx.moveTo(pos.x, pos.y);
                this.initTemporaryPts(pos);
                
                // Emulate motion to the before last point
                let points =  this.segmentArray[this.currSegment].pts;
                for (let nr = 3; nr < points.length; nr++) {
                    this.drawStep(points[nr]); // This method updates temporary points
                }

                //Emulate pointerup and join the before last point and the last by a line
                if (points.length > 1) {
                    this.lineTo(points[points.length - 1]);
                }
            }
        }
    }
    renderDataBm() {

    }
    /**
     * Renders stored pen data, if available using the rendering appropriate for the data type.
     */
    renderPenData() {
        if (this.canvas.dataset.penov) { // Checks among others for undefined and ''
            if (this.storageType == 'points') {
                this.renderDataPts();
                // setTimeout(() => { this.renderDataPts(); document.body.style.cursor = 'default';}, 2000);
            } else if (this.storageType == 'bitmap') {
                this.renderDataBm();
            }
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

   
    /**
     * ============================================================
     * Drawing event handlers
     * ============================================================
     */
    loadH(event) {

        // It is essential to write the attribute of canvas, not the css style
        // Equally it is necessary to read clientWidth and clientHeight and not style values
        this.canvas.width = this.main.clientWidth;
        this.canvas.height = this.main.clientHeight;
        this.ctx = this.canvas.getContext('2d');
        // Render stored pen data, if available
        this.renderPenData();
        this.buildCommandPanel();
        // this.consumeTime();
        this.loadingIndicator.style['display'] = 'none';
    }
    boundLoadH = this.loadH.bind(this);
    downH(event) {
        event.preventDefault();
        this.pointerDown = true;
        this.canvas.style.cursor = 'crosshair';
        this.lastPos = this.canvasPos(event);
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.penColor;
        this.ctx.lineWidth = this.penWidth;
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.moveTo(this.lastPos.x, this.lastPos.y);
        this.newSegment(this.lastPos);
    }
    boundDownH = this.downH.bind(this);
    moveH(event) {
        if (this.pointerDown) {
            event.preventDefault();
            let pos = this.canvasPos(event);
            let d2 = this.norm2(this.vector(this.lastPos, pos));
            if (d2 > this.minDist2) {
                this.drawTo(pos);
                this.lastPos = pos;
            }
        }
    }
    boundMoveH = this.moveH.bind(this);
    upH(event) {
        event.preventDefault();
        this.canvas.style.cursor = 'default';
        this.pointerDown = false;
        let pos = this.canvasPos(event);
        this.lineTo(pos);
    }
    boundUpH = this.upH.bind(this);
    storeH(event) {
        // Remove all additional HTML created by JS
        this.commandDiv.remove();
        // Remove styles from loadingIndicator. 
        // Drawing to the canvas adds styles inherited from canvas for no apparent reason.
        // LoadH adds display: none.
        this.loadingIndicator.style = undefined;
        // prepare the data to be stored in canvas
        let data = undefined;
        this.canvas.setAttribute('data-penovst', this.storageType);
        if (this.storageType == 'points') {
            // Store the segment array in JSON format
            data = JSON.stringify(this.segmentArray);
        } else if (this.storageType == 'bitmap') {
            // data = JSON.stringify(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
            data = this.canvas.toDataURL('image/jpeg', 0.5); // the bitmap is far too large
        }
        this.canvas.setAttribute('data-penov', data);
        // Save the overlayed document as a hidden POST variable in JSON format
        let hiddenDocument = document.createElement('input');
        hiddenDocument.name = 'penov-document';
        hiddenDocument.type = 'hidden';
        hiddenDocument.value = this.parent.innerHTML;
        // Add a second hidden POST with the original name of the store button
        let hidden = document.createElement('input');
        hidden.name = 'penov-store';
        hidden.type = 'hidden';
        hidden.value = 'penov-store';
        // Submit the form
        let form = event.target.form;
        form.appendChild(hiddenDocument);
        form.appendChild(hidden);
        form.submit();
    }
    boundStoreH = this.storeH.bind(this);
   
    /**
     * ============================================================
     * Command panel event handlers
     * ============================================================
     */
    penClickH(event) {
        this.setMode('pen');
    }
    boundPenClickH = this.penClickH.bind(this);
    markerClickH(event) {
        this.setMode('marker');
    }
    boundMarkerClickH = this.markerClickH.bind(this);
    rubberClickH(event) {
        this.setMode('rubber');
    }
    boundrubberClickH = this.rubberClickH.bind(this);
    cpClickH(event) {
        let pos = this.colorCanvasPos(event);
        console.log(pos);
        // Check if pos is within a bounding square of one of the color circles
        if (Math.abs(pos.x - cpLeftC) <= cpRadius) {
            if (Math.abs(pos.y - cpUpperC) <= cpRadius) {
                // Upper left
                this.penColor = this.defaultPenColor;
            } else if (Math.abs(pos.y - cpLowerC) <= cpRadius) {
                // Lower left
                this.penColor = cpLLcolor;
            }
        } else if (Math.abs(pos.x - cpRightC) <= cpRadius) {
            if (Math.abs(pos.y - cpUpperC) <= cpRadius) {
                // Upper right
                this.penColor = cpURcolor;
            } else if (Math.abs(pos.y - cpLowerC) <= cpRadius) {
                // Lower right
                this.penColor = cpLRcolor;
            }
        }
        this.showCurrentColor();
    }
    boundCpClickH = this.cpClickH.bind(this);
}