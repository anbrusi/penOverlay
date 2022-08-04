
export function attachPenOverlay(params) {
    let penOverlay = new PenOverlay(params);
}

import {RubberBand} from './rubberBand.js';
import {RubberLine} from './rubberLine.js';

const commandPanelHeight = 80; // Can be freely chosen, but conditions cpHeight
const commandPanelWidth = 270; // Must be chosen to suit colorCanvas, determined by cpSpace and cpRadius
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

/**
 * Colors used in the color part of the command panel.
 * These colors become the pen color in commendMode == 'pen
 */
const cpURcolor = '#00EE00'; // green
const cpLLcolor = '#0044DD'; // blue
const cpLRcolor = '#FFBB22'; // yellow

const markerURcolor = '#00EE0060'; // semitransparent green
const markerLLcolor = '#0044DD60'; // semitransparen blue
const markerRLcolor = '#FFBB2260'; // semitransparen yellow

/**
 * Directory of icons. 
 */
// const imgDir = './isImg/'; // On Mac local developemnet and Cyon
const imgDir = '/isImg/'; // On surface

/**
 * PenOverlay works together with its counterpart in PHP.
 * It allows pen annotation of a document by allowing to write on a canvas placed over a HTML document.
 * The PHP part is responsible for the display of the document in a standardized way. If the document
 * is not already wrapped it must wrapped as follows:
 * NOTE: in case of several pen overlay areas on the same page specifiers are appended to the id's to make them unique
 * 
 *      <!--penOverlay-->
 *      <div id="penov-main">
 *          <div id="penov-raw">
 *              HTML for the document
 *          </div>
 *          <canvas id="penov-canvas" data-penov=""></canvas>
 *          <div  id="penov-loading" class="loadingIndicator"></div>';
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
 * HTML for the document may not be suited for pen annotation, because the font is to small, lines are vertically to dense,
 * there is no right mrgin etc. To obviate this deficiency the containing <div id="penov-raw"> is styled by
 * $params['rawStyles], which is a string in css notation like 'margin-left: 10px; margin-right: 50%; line-height: 2em; font-size: 200%'.
 * 
 * NOTE: Do not use this parameter, when loading already wrapped documents. 
 * Changes in layout of base HTML would infringe the correspondence between base and pen locations.
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
    defaultPenWidth = 1;
    /**
     * Can be overriden if 'defaultMarkerWidth' is set in 'params' of the constructor
     */
    defaultMarkerWidth = 10;
    /**
     * This is both the current pen width and the current marker width used when drawing
     */
    penWidth = undefined;
    /**
     * The command panel does not show different colors for pen and marker,
     * but because the marker is semi transparent and the pen is not, they are differnt.
     * The command panel shows only pen colors. This is identical with the pen color
     */
    cpColor = undefined;
    /**
     * Can be overriden if 'penColor' is set in 'params' of the constructor
     */
    defaultPenColor = '#FF4444';
    /**
     * This is the current pen color. It is not identical with cpCopor, which is the current command panel color
     * For the pen both are the same, but for the marker penColor adds semi transparency to the command panel color
     */
    penColor = undefined;
    /**
     * Can be overriden if 'penStepType' is set in 'params' of the constructor
     * Allowed stepTypes are 'L' for linear and 'B' for Bezier
     */
    penStepType = 'B';
    /**
     * Can be overriden if 'markerStepType' is set in 'params' of the constructor
     * Allowed stepTypes are 'L' for linear and 'B' for Bezier
     */
    markerStepType = 'B';
    /**
     * Is set in setMode, according to mode. Is used for drawing of pen and marker
     */
    stepType = undefined;
    /**
     * Minimal square distance between two registered points for 'pen' mode
     * Can be overridden by setting penMinDist2 in params
     */
    penMinDist2 = 20;
    /**
     * Minimal square distance between two registered points
     * Can be overridden by setting markerMinDist2 in params
     */
    markerMinDist2 = 400;
    /**
     * Minimal square distance between two registered points. Mode dependent. Is set by this.setMode
     */
    minDist2 = undefined;
    /**
     * Pen data can be stored as point (type = 'points')
     * or bitmap (type = 'bitmap')
     */
    storageType = 'points';
    /**
     * The specifier appended to id's to distinguish betweeen different pen overlay areas
     */
    specifier = '';
    /**
     * If this is set to true, no command panel is shown. So mode cannot be changed and no action event listeners are set
     */
    readonly = false;
    /**
     * The penov-main div
     */
    main = undefined;
    /**
     * The div holding the raw document, which will be corrected
     */
    raw = undefined;
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
    rulerMarkerImage = undefined;
    rubberImage = undefined;
    /**
     * One of the modes in which PenOverlay work.
     * Modes are: 'none', 'pen', 'marker', 'rulerMarker', 'rubber'
     */
    commandMode = 'none';
    /**
     * The constructor instantiates the class RubberBand as a child of penov-main
     */
    rubberBand = undefined;
    /**
     * The constructor instantiates the class RubberLine as a child of penov-main
     */
    rubberLine = undefined;

      
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
        if (parameters['defaultPenWidh']) {
            this.defaultPenWidth = parameter['defaultPenWidth'];
        }
        if (parameters['defaultMarkerWidh']) {
            this.defaultMarkerWidth = parameter['defaultMarkerWidth'];
        }
        if (parameters['defaultPenColor']) {
            this.defaultPenColor = parameters['defaultPenColor'];
        }
        if (parameters['penStepType']) {
            this.penStepType = parameters['penStepType'];
        }
        if (parameters['markerStepType']) {
            this.markerStepType = parameters['markerStepType'];
        }
        if (parameters['markerMinDist2']) {
            this.markerMinDist2 = parameters['markerMinDist2'];
        }
        if (parameters['penMinDist2']) {
            this.penMinDist2 = parameters['penMinDist2'];
        }
        if (parameters['storageType']) {
            this.storageType = parameters['storageType'];
        }
        if (parameters['bezCtrl']) {
            this.bezCtrl = parameters['bezCtrl'];
        }
        // Different pen overlay areas areas have different specifiers appended to the id's 'penov-main', 'penov-raw', 'penov-canvas', 'penov-loading'
        if (parameters['specifier']) {
            this.specifier = parameters['specifier'];
        }
        // Set read only to true, if required
        if (parameters['readonly'] && parameters['readonly'] === true) {
            this.readonly = true;
        }
        // Set initial colors for the control panel
        this.cpColor = this.defaultPenColor;
        // Get the loading indicator, to be able to remove it after loading
        this.loadingIndicator = document.getElementById('penov-loading' + this.specifier);
        // Set penov-main properties.
        this.main = document.getElementById('penov-main' + this.specifier);
        this.main.style['background-color'] = this.backgroundColor;
        this.main.style['touch-action'] = 'none'; 
        this.main.style.width = this.mainWidth;
        this.main.style.overflow = 'hidden';
        this.main.style.position = 'relative'; // Set relative position in order to place its child canvas absolutely
        // Set raw properties
        this.raw = document.getElementById('penov-raw' + this.specifier);
        if (parameters['rawStyles']) {
            this.raw.style.cssText = parameters['rawStyles'];
        }
        // Prepare canvas. The position is absolute and set to cover 'penov-main'
        this.canvas = document.getElementById('penov-canvas' + this.specifier);
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = 0;

        // Override the default storage type, if the document has a defined storage type
        let loadedStorageType = this.canvas.dataset.penovst;
        if (loadedStorageType) {
            this.storageType = loadedStorageType;
        }

        // Replace the store buttons, i.e. all buttons with name 'penov-store'
        this.replaceStoreButtons();
        window.addEventListener('load', this.boundLoadH); // Adjusts dimension after having loaded the images and sets this.ctx  

        // Instantiate a rubber band
        let rbParams = {
            parentid: 'penov-main' + this.specifier
        }
        this.rubberBand = new RubberBand(rbParams);
        // Instantiate a rubber line
        this.rubberLine = new RubberLine(rbParams);
    }
    /**
     * Draws a rectangele inn the color canvas of the command panel, using the current color
     * 
     * @param {obj} ctx 
     */
    showCurrentColor() {
        this.colorCtx.fillStyle = this.cpColor;
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
        this.commandDiv.style.top = (coordinates.top + window.scrollY) + 'px';
        this.commandDiv.style.right = '5px';
        // Pen image
        this.penImage = document.createElement('img');
        this.penImage.setAttribute('src', imgDir + 'penov_pen_idle.png');
        this.penImage.style.height = '80px';
        this.markerImage = document.createElement('img');
        this.markerImage.setAttribute('src', imgDir + 'penov_marker_idle.png');
        this.markerImage.style.height = '80px';
        this.rulerMarkerImage = document.createElement('img');
        this.rulerMarkerImage.setAttribute('src', imgDir + 'penov_ruler_marker_idle.png');
        this.rulerMarkerImage.style.height = '80px';
        this.rubberImage = document.createElement('img');
        this.rubberImage.setAttribute('src', imgDir + 'penov_rubber_idle.png');
        this.rubberImage.style.height = '80px';
        this.commandDiv.appendChild(this.penImage);
        this.commandDiv.appendChild(this.markerImage);
        this.commandDiv.appendChild(this.rulerMarkerImage);
        this.commandDiv.appendChild(this.rubberImage);
        this.buildColorCanvas();
        this.commandDiv.appendChild(this.colorCanvas);
        this.main.appendChild(this.commandDiv);
        // Attatch click handlers to the images
        this.penImage.addEventListener('click', this.boundPenClickH);
        this.markerImage.addEventListener('click', this.boundMarkerClickH);
        this.rulerMarkerImage.addEventListener('click', this.boundRulerMarkerClickH);
        this.rubberImage.addEventListener('click', this.boundrubberClickH);
        this.colorCanvas.addEventListener('click', this.boundCpClickH);

    }
    setStrokeStyle() {
        switch (this.commandMode) {
            case 'pen':
                this.penColor = this.cpColor; // Take the current color of the command panel
                break;
            case 'marker':
            case 'rulerMarker':
                // + '60' makes the command panel color semi transparent
                this.penColor = this.cpColor + '60';
                break;
        }
        this.ctx.strokeStyle =this.penColor;
    }
    setListeners(mode) {
        switch (mode) {
            case 'pen':
            case 'marker':
                // Add the pen and marker listeners
                if (this.stepType == 'L') {
                    this.canvas.addEventListener('pointerdown', this.boundDownH);
                    document.addEventListener('pointermove', this.boundMoveLinH);
                    document.addEventListener('pointerup', this.boundUpH);
                } else if (this.stepType == 'B') {                    
                    this.canvas.addEventListener('pointerdown', this.boundDownH);
                    document.addEventListener('pointermove', this.boundMoveBezH);
                    document.addEventListener('pointerup', this.boundUpH);
                }
                break;
            case 'rulerMarker':
                // Add the ruler marker listeners
                this.rubberLine.addListeners();
                this.main.addEventListener('rubberLine', this.boundRubberLineH); // This listens to the custom event.
                this.rubberLine.enabled = true;
                break;
            case 'rubber':
                this.rubberBand.addListeners(); // Theese are the listeners used by the rubber band itself
                this.main.addEventListener('rubberRectangle', this.boundRubberRectH); // This listens to the custom event.
                this.rubberBand.enabled = true;
                break;
        }
    }
    unsetListeners(mode) {
        switch (mode) {
            case 'pen':
            case 'marker':
                // Remove the pen and marker listeners
                if (this.stepType == 'L') {
                    this.canvas.removeEventListener('pointerdown', this.boundDownH);
                    document.removeEventListener('pointermove', this.boundMoveLinH);
                    document.removeEventListener('pointerup', this.boundUpH);
                } else if (this.stepType == 'B') {                    
                    this.canvas.removeEventListener('pointerdown', this.boundDownH);
                    document.removeEventListener('pointermove', this.boundMoveBezH);
                    document.removeEventListener('pointerup', this.boundUpH);
                }
                break;
            case 'rulerMarker':
                // Remove the ruler marker listeners
                this.rubberLine.removeListeners();
                this.main.removeEventListener('rubberLine', this.boundRubberLineH);
                this.rubberLine.enabled = false;
                break;
            case 'rubber':
                this.rubberBand.removeListeners();
                this.main.removeEventListener('rubberRectangle', this.boundRubberRectH);
                this.rubberBand.enabled = false;
        }
    }
    setMode(mode) {
        this.unsetMode(this.commandMode);
        this.commandMode = mode;
        switch (mode) {
            case 'pen':
                // This.penWidth is the current pen width and it is the same for pen and marker
                this.penWidth = this.defaultPenWidth;
                this.stepType = this.penStepType;
                this.ctx.lineJoin = 'round';
                this.ctx.lineCap = 'round';
                this.ctx.lineWidth = this.penWidth;
                this.minDist2 = this.penMinDist2;
                // We handle this separately, because stroke style does not change only with command mode
                // but with a color change as well.
                this.setStrokeStyle();
                // Change the pen image in command panel to active
                this.penImage.setAttribute('src', imgDir + 'penov_pen_active.png');
                this.pointerDown = false;
                break;
            case 'marker':
                // This.penWidth is the current pen width and it is the same for pen and marker
                this.penWidth = this.defaultMarkerWidth;
                this.stepType = this.markerStepType;
                this.ctx.lineJoin = 'round';
                this.ctx.lineCap = 'butt';
                this.ctx.lineWidth = this.penWidth;
                this.minDist2 = this.markerMinDist2;
                // We handle this separately, because stroke style does not change only with command mode
                // but with a color change as well.
                this.setStrokeStyle();
                this.markerImage.setAttribute('src', imgDir + 'penov_marker_active.png');
                this.pointerDown = false;
                break;
            case 'rulerMarker':
                // This.penWidth is the current pen width and it is the same for pen and marker
                this.penWidth = this.defaultMarkerWidth;
                this.stepType = this.markerStepType;
                this.ctx.lineJoin = 'round';
                this.ctx.lineCap = 'butt';
                this.ctx.lineWidth = this.penWidth;
                this.minDist2 = this.markerMinDist2;
                // We handle this separately, because stroke style does not change only with command mode
                // but with a color change as well.
                this.setStrokeStyle();
                this.rulerMarkerImage.setAttribute('src', imgDir + 'penov_ruler_marker_active.png');
                break;
            case 'rubber':
                this.rubberImage.setAttribute('src', imgDir + 'penov_rubber_active.png');
                break;
        }
        this.setListeners(mode);
    }
    unsetMode(mode) {
        switch (mode) {
            case 'pen':
                this.penImage.setAttribute('src', imgDir + 'penov_pen_idle.png');
                break;
            case 'marker':
                this.markerImage.setAttribute('src', imgDir + 'penov_marker_idle.png');
                break;
            case 'rulerMarker':
                this.rulerMarkerImage.setAttribute('src', imgDir + 'penov_ruler_marker_idle.png');
                break;
            case 'rubber':
                this.rubberImage.setAttribute('src', imgDir + 'penov_rubber_idle.png');
                break;
        }
        this.unsetListeners(mode);
        this.commandMode = 'none';
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
    /**
     * Refers to the mini canvas in the control panel used for color choice
     * 
     * @param {object} event 
     * @returns 
     */
    colorCanvasPos(event) {        
        let rect = this.colorCanvas.getBoundingClientRect();
        return {
            x: event.pageX - rect.left - window.scrollX,
            y: event.pageY - rect.top - window.scrollY
        }
    }
    allowedPointer(event) {
        return event.pointerType == 'mouse' || event.pointerType == 'pen';
    }
    /**
     * This will be the method this.newSegment() if this.storageType = 'points'
     * Initialises a new segment (a connected path with given style in the canvas)
     * Builds a segment from current values for width, color, stepType and adds it to this.segmentArray.
     * Its index is set as this.currSegment
     * The very first point p is added to the pts array of the segment.
     * The 4 temporary points this.p1 to this.p4 are created. this.p1 is defined and set to p
     * 
     * @param {object} p 
     */
    newSegment(p) {
        // Pen width is different for pen and marker, it is set in this.setMode
        let segment = {
            width: this.penWidth,
            color: this.penColor,
            stepType: this.stepType,
            pts: []
        }
        this.segmentArray.push(segment);
        this.currSegment = this.segmentArray.length - 1;
        this.newPoint(p);
    }
    /**
     * Adds a point 'pos' to pts array in the current segment
     * 
     * @param {object} pos 
     */
    newPoint(pos) {
        this.segmentArray[this.currSegment].pts.push(pos);
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
    /**
     * Checks if point pt is in the rectangle delimited by top, bottom, left, right
     * 
     * @param {object} pt 
     * @param {number} top 
     * @param {number} bottom 
     * @param {number} left 
     * @param {number} right 
     * @returns 
     */
    inRect(pt, top, bottom, left, right) {
        if (pt.y < top || pt.y > bottom) {
            return false;
        }
        if (pt.x < left || pt.x > right) {
            return false;
        }
        return true;
    }
    norm2(v) {
        return v.x * v.x + v.y * v.y;
    }
    /**
     * Draws a single segment from point p1 to point p2 on canvas.
     * Note that drawing consecutive segments should not be done with this method,
     * because it would treat the segments as isolated, neglecting the joins
     * 
     * @param {object} p1 
     * @param {object} p2 
     */
    drawLineSegment(p1, p2) {
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
    }
    /**
     * Draws a line from the current canvas position to the point with position pos
     * @param {integer} pos 
     */
    lineTo(pos) {
        console.log(pos);
        this.ctx.lineTo(pos.x, pos.y);
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
    }
    /**
     * Draws a bezier curve from point p2 to point p3, using p1 and p4 as control points
     * 
     * @param {*} p1 
     * @param {*} p2 
     * @param {*} p3 
     * @param {*} p4 
     */
    drawBezier(p1, p2, p3, p4) {
        this.ctx.beginPath();
        this.ctx.moveTo(p2.x, p2.y);
        this.bezier(p1, p2, p3, p4);
        this.ctx.stroke();
    }
    /**
     * Applies only to 'storageType' = points
     * Deletes all those segments, which have the first point inside a rectangle described by top, left, height, width
     * Segments must be eliminated one at a time because they are not necessarily adiacent and splice does a renumbering.
     * 
     * 
     * @param {number} top 
     * @param {number} left 
     * @param {number} height 
     * @param {number} width 
     */
    deletePts(top, left, height, width) {
        console.log('delete top=' + top + ' left=' + left + ' height=' + height + ' width=' + width);
        let bottom = top + height;
        let right = left + width;
        let done = (this.segmentArray.length == 0); // Exclude the case, where there are no segments at all
        while (!done) {
            for (let i = 0; i < this.segmentArray.length; i++) {
                // Check for the last segment BEFORE possibly splicing, lest break would exit the for loop before a check can be made
                if (i == this.segmentArray.length - 1){
                    done = true;
                }
                if (this.segmentArray[i].pts[0]) {
                    if (this.inRect(this.segmentArray[i].pts[0], top, bottom, left, right)) {
                        console.log('splicing position ' + i);
                        this.segmentArray.splice(i, 1);
                        break;
                    }
                }
            }
        }
    }
    /**
     * Prepare the context this.ctx for rendering from this.segmentArray
     */
    prepareContext(currSegment) {          
        this.ctx.strokeStyle = currSegment.color;
        this.ctx.lineWidth = currSegment.width;
        if (currSegment.width > 4) {
            // It was a marker
            this.ctx.lineJoin = 'bevel';
            this.ctx.lineCap = 'round';
        } else {
            // it was a pen
            this.ctx.lineJoin = 'round';
            this.ctx.lineCap = 'round';
        }
    }
    /**
     * Renders a segment on canvas. No precondition, uses begin path at the start and stroke at the end of the path
     * 
     * @param {object} segment 
     */
    renderSegment(segment) {
        let pts = segment.pts;
        this.prepareContext(segment);
        // Initialize
        this.ctx.beginPath();
        if (segment.stepType == 'L') {
            // Join points by a line
            if (pts.length > 1) {
                this.ctx.moveTo(pts[0].x, pts[0].y);
                for (let j = 1; j < pts.length; j++) {
                    // Add a line to the next point
                    this.ctx.lineTo(pts[j].x, pts[j].y);
                }
            }
        } else if (segment.stepType == 'B') {
            // Join points up to the before last by a bezier curve and the before last to the last by a line
            if (segment.pts.length >= 4) {
                // we join the first two points by a line and successive poits up to the before last by e bezier curve 
                this.ctx.moveTo(pts[0].x, pts[0].y);
                this.ctx.lineTo(pts[0].x, pts[1].y);
                for (let j = 0; j < pts.length - 4; j++) {
                    this.bezier(pts[j], pts[j + 1], pts[j + 2], pts[j + 3]);
                }
                this.ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            } else if (pts.length > 1) {
                // We have 2 or 3 points
                this.ctx.moveTo(pts[0].x, pts[0].y);
                for (let j = 1; j < pts.length; j++) {
                    // Add a line to the next point
                    this.ctx.lineTo(pts[j].x, pts[j].y);
                }
            }
        }
        this.ctx.stroke();
    }
    /**
     * Renders this.segmentArray on the canvas by rendering all segments
     */
    canvasFromPts() {
        for (let i = 0; i < this.segmentArray.length; i++) {
            this.renderSegment(this.segmentArray[i]);
        }
    }
    /**
     * Renders stored pen and marker data, if available using the rendering appropriate for the data type.
     */
    renderStoredData() {
        if (this.canvas.dataset.penov) { // Checks among others for undefined and ''
            if (this.storageType == 'points') {
                this.segmentArray = JSON.parse(this.canvas.dataset.penov);
                this.canvasFromPts();
            } else if (this.storageType == 'bitmap') {

            }
        }
    }
    /**
     * Applies only to 'storageType' 0 'points'
     * 
     * Clears the canvas and redraws it from 'this.segmentArray'
     */
    refreshPts() {
        // clear the whole canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Redraw the canvas with the current segment array
        this.canvasFromPts();
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
        this.renderStoredData();
        if (!this.readonly) {
            this.buildCommandPanel();
        }
        // this.consumeTime();
        this.loadingIndicator.style['display'] = 'none';
    }
    boundLoadH = this.loadH.bind(this);
    downH(event) {
        if (this.allowedPointer(event) && !this.pointerDown) {
            event.preventDefault();
            this.pointerDown = true;
            if (event.pointerType == 'mouse') {
                this.canvas.style.cursor = 'crosshair';
            } else {
                this.canvas.style.cursor = 'none';
            }
            this.lastPos = this.canvasPos(event);
            this.newSegment(this.lastPos); // Initializes temporary points in any case
        }
    }
    boundDownH = this.downH.bind(this);
    moveLinH(event) {
        if (this.allowedPointer(event) && this.pointerDown) {
            event.preventDefault();
            let pos = this.canvasPos(event);
            let d2 = this.norm2(this.vector(this.lastPos, pos));
            if (d2 > this.minDist2 || this.segmentArray[this.currSegment].pts.length < 4) {
                this.newPoint(pos);
                this.drawLineSegment(this.lastPos, pos);
                this.lastPos = pos;
            }
        }
    }
    boundMoveLinH = this.moveLinH.bind(this);
    moveBezH(event) {
        if (this.allowedPointer(event) && this.pointerDown) {
            event.preventDefault();
            let pos = this.canvasPos(event);
            let d2 = this.norm2(this.vector(this.lastPos, pos));
            let points = this.segmentArray[this.currSegment].pts;
            if (d2 > this.minDist2 || points.length < 8) {
                this.newPoint(pos);
                let last = points.length - 1;
                // We must join last -2 and last -1, since for Bezier we need the last as control point
                if (last >= 3) {
                    // Join last - 2 and last -1 by a Bezier curve
                    this.drawBezier(points[last - 3], points[last -2], points[last - 1], points[last]);
                } else if (last >= 2) {
                    // Join last - 2 and last -1 by a line segment
                    this.drawLineSegment(points[last -2], points[last - 1]);
                }
            }
        }
    }
    boundMoveBezH = this.moveBezH.bind(this);
    upH(event) {
        if (this.allowedPointer(event) && this.pointerDown) {
            event.preventDefault();
            this.canvas.style.cursor = 'default';
            this.pointerDown = false;
            let pos = this.canvasPos(event);
            this.lineTo(pos);
        }
    }
    boundUpH = this.upH.bind(this);
    storeH(event) {
        // Remove all additional HTML created by JS
        this.rubberBand.terminate(); // Remove the div used as rubber band
        this.rubberLine.terminate(); // Remove the div used as rubber line
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
        if (this.commandMode == 'pen') {
            // This is a click on an active pen
            this.setMode('none'); // Deactivate the pen
        } else {
            this.setMode('pen');
        }
    }
    boundPenClickH = this.penClickH.bind(this);
    markerClickH(event) {
        if (this.commandMode == 'marker') {
            // This is a click on an active pen
            this.setMode('none'); // Deactivate the pen
        } else {
            this.setMode('marker');
        }
    }
    boundMarkerClickH = this.markerClickH.bind(this);
    rulerMarkerClickH(event) {
        if (this.commandMode == 'rulerMarker') {
            // This is a click on an active pen
            this.setMode('none'); // Deactivate the pen
        } else {
            this.setMode('rulerMarker');
        }
    }
    boundRulerMarkerClickH = this.rulerMarkerClickH.bind(this);
    rubberClickH(event) {
        if (this.commandMode == 'rubber') {
            // This is a click on an active pen
            this.setMode('none'); // Deactivate the pen
        } else {
            this.setMode('rubber');
        }
    }
    boundrubberClickH = this.rubberClickH.bind(this);
    cpClickH(event) {
        let pos = this.colorCanvasPos(event);
        console.log(pos);
        // Check if pos is within a bounding square of one of the color circles
        if (Math.abs(pos.x - cpLeftC) <= cpRadius) {
            if (Math.abs(pos.y - cpUpperC) <= cpRadius) {
                // Upper left
                this.cpColor = this.defaultPenColor;
            } else if (Math.abs(pos.y - cpLowerC) <= cpRadius) {
                // Lower left
                this.cpColor = cpLLcolor;
            }
        } else if (Math.abs(pos.x - cpRightC) <= cpRadius) {
            if (Math.abs(pos.y - cpUpperC) <= cpRadius) {
                // Upper right
                this.cpColor = cpURcolor;
            } else if (Math.abs(pos.y - cpLowerC) <= cpRadius) {
                // Lower right
                this.cpColor = cpLRcolor;
            }
        }
        this.setStrokeStyle();
        this.showCurrentColor();
    }
    boundCpClickH = this.cpClickH.bind(this);

    /**
     * ===================================================================
     * Rubber rectangle defined handler. Custom event raised by RubberBand
     * ===================================================================
     */
    rubberRectH(event) {
        if (this.storageType == 'points') {
            this.deletePts(event.detail.top, event.detail.left, event.detail.height, event.detail.width);
            this.refreshPts();
        } else if (this.storageType == 'bitmap') {

        }
    }
    boundRubberRectH = this.rubberRectH.bind(this);
     /**
     * ===================================================================
     * Rubber rectangle defined handler. Custom event raised by RubberLine
     * ===================================================================
     */
    rubberLineH(event) {
        if (this.storageType == 'points') {
            // Draw a segment from startPoint to endPoint
            this.newSegment(event.detail.startPoint);
            this.newPoint(event.detail.endPoint);
            this.drawLineSegment(event.detail.startPoint, event.detail.endPoint);
        } else if (this.storageType == 'bitmap') {

        }
    }
    boundRubberLineH = this.rubberLineH.bind(this);
}