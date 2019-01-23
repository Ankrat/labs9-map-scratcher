

//== Scratchable Canvas ========================================================

//-- Project Constants ---------------------------
export const COMPLETION_CHECK_RATE = 1000/4;
/* Completion Check Rate: The number of miliseconds between checks to see if
    the user has completed scratching the entire map. (only takes place during
    and immediately after scratch actions.) */
export const COMPLETION_PIXEL_RATIO = 1/70;
/* Completion Pixel Ratio: The ratio of unscratched pixels to scratchable pixels
    below which scratching is considered complete. */
export const OUTLINE_WIDTH = 5;
/* OUTLINE_WIDTH: The size of the outline around the scratchable country map.
    Will be rounded up to nearest integer. */
export const SCRATCH_LINE_WIDTH = 28;
/* SCRATCH_LINE_WIDTH: the width of lines that are scratched into the map while
    the user scratches across the map (either via mouse or touch device). */


//== Initialization ============================================================

//-- Initialize Canvas ---------------------------
export function initializeCanvas(drawingState, movementHandler) {
    // Setup Main canvas and drawing context
    const canvas = drawingState.displayCanvas;
    // Determine dimensions of available drawing container
    const bounds = canvas.getBoundingClientRect();
    canvas.width  = bounds.right  - bounds.left;
    canvas.height = bounds.bottom - bounds.top ;
    // Add event listeners for sratching actions
    canvas.addEventListener(
        'mousemove',
        mouseEvent => {
            const moveCoordinates = coordinatesOfMouse(mouseEvent, canvas);
            movementHandler(moveCoordinates.x, moveCoordinates.y);
        },
    );
    canvas.addEventListener(
        'touchmove',
        touchEvent => {
            const touchCoordinates = coordinatesOfTouch(touchEvent, canvas);
            movementHandler(touchCoordinates.x, touchCoordinates.y);
        },
    );
    // Save drawing context
    drawingState.mainContext = canvas.getContext('2d');
}
    
//-- Create Compositing Canvas -------------------
export function createCompositingCanvas(drawingState) {
    // Setup compositing canvas and context
    const compositingCanvas = document.createElement('canvas');
    compositingCanvas.width  = drawingState.displayCanvas.width ;
    compositingCanvas.height = drawingState.displayCanvas.height;
    drawingState.compositingContext = compositingCanvas.getContext('2d');
}

//-- Load Resources for specific Country ---------
export async function configureCountry(drawingState, urlMap, urlFlag) {
    // Create images of the map (alpha mask) and flag, to be used in draw
    const imageMap  = new Image();
    const imageFlag = new Image();
    // Create a promise that will resolve once the image loads
    function loadImage(unloadedImage, urlToLoad) {
        return new Promise((resolve, reject) => {
            unloadedImage.addEventListener("error", reject);
            unloadedImage.addEventListener(
                "load",
                function () { resolve(unloadedImage);},
            );
            unloadedImage.src = urlToLoad;
        });
    }
    // Wait for both to load
    await Promise.all([
        loadImage(imageMap , urlMap ),
        loadImage(imageFlag, urlFlag),
    ]);
    // Save images
    drawingState.imageMap  = imageMap ;
    drawingState.imageFlag = imageFlag;
};


//== Drawing ===================================================================

//-- Check Size (handle resize) ------------------
export function checkSize(drawingState) {
    const canvas = drawingState.displayCanvas;
    const compositingContext = drawingState.compositingContext;
    // Compare current dimensions to previous dimensions
    const bounds = canvas.parentNode.getBoundingClientRect();
    const oldWidth  = canvas.width ;
    const oldHeight = canvas.height;
    const newWidth  = bounds.right  - bounds.left;
    const newHeight = bounds.bottom - bounds.top ;
    if(newWidth === oldWidth && newHeight === oldHeight) { return;}
    // Redraw outline at larger size
    canvas.width  = newWidth ;
    canvas.height = newHeight;
    compositingContext.canvas.width  = newWidth ;
    compositingContext.canvas.height = newHeight;
    generateOutline(drawingState);
    // Redraw scratch layer at larger size
    createScratchLayer(drawingState);
}

//-- Draw full map scratcher ---------------------
export function draw(drawingState) {
    const context = drawingState.mainContext;
    const canvas = context.canvas;
    context.save();
    // Fix canvas if a resize has occurred since last draw
    checkSize(drawingState);
    // Clear Canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    // Set Alpha Mask
    centerImage(drawingState.imageMap, context, {
        margin: OUTLINE_WIDTH,
    });
    context.globalCompositeOperation = 'source-in';
    // Draw Background
    context.fillStyle = drawingState.colorScratch;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Draw Foreground (Flag)
    if(drawingState.itchy){
        drawScratchOverlay(drawingState);
    }
    // Draw Outline
    context.globalCompositeOperation = 'destination-over';
    context.drawImage(
        drawingState.imageOutline,
        0, 0,
        canvas.width, canvas.height
    );
    // Cleanup
    context.restore();
}

//-- Generate Outline ----------------------------
export function generateOutline(drawingState) {
    const compositingContext = drawingState.compositingContext;
    const canvas = compositingContext.canvas;
    // Save old data from compositing canvas
    const savedData = compositingContext.getImageData(
        0, 0, canvas.width, canvas.height,
    );
    compositingContext.save();
    // Create new canvas to use as source image to draw onto this context
    const stampCanvas = document.createElement('canvas');
    stampCanvas.width  = canvas.width ;
    stampCanvas.height = canvas.height;
    const stampContext = stampCanvas.getContext('2d');
    // Draw country shape onto stamp canvas
    stampContext.fillStyle = drawingState.colorOutline;
    centerImage(drawingState.imageMap, stampContext, {
        margin: OUTLINE_WIDTH,
    });
    stampContext.globalAlpha = 0.3;
    stampContext.globalCompositeOperation = 'source-in';
    stampContext.fillRect(0, 0, stampCanvas.width, stampCanvas.height);
    stampContext.globalAlpha = 1;
    // Build outline by repeatedly drawing "stamp" at several pixel offsets
    let outlineWidth = OUTLINE_WIDTH;
    for(let iteration = 0; iteration < outlineWidth; iteration++) {
        compositingContext.clearRect(0, 0, canvas.width, canvas.height);
        for(let posY = -1; posY <= 1; posY++) {
            for(let posX = -1; posX <= 1; posX++) {
                compositingContext.drawImage(stampCanvas, posX, posY);
            }
        }
        stampContext.globalCompositeOperation = 'copy';
        stampContext.drawImage(canvas, 0, 0);
    }
    // Restore compositing canvas to previous state
    compositingContext.restore();
    compositingContext.putImageData(savedData, 0, 0);
    // Save outline for later use
    drawingState.imageOutline = stampCanvas;
}

//-- Draw image centered on supplied context -----
export function centerImage(sourceImage, context, options) {
    /* Draw sourceImage into the center of supplied context, with options:
        offsetX / offsetY: Offset drawing location by number of pixels,
            which is useful for a slight thickness effect.
        margin: Allow a margin of extra pixels around the image, which is
            useful for drawing an outline around the shape later.
        cover: Set to True to ensure that the image covers the entire canvas
            while perserving its aspect ratio. This is necessary to ensure
            that the country's flag covers all of its map area.
    */
    const canvas = context.canvas;
    options = options || {};
    const margin  = options.margin  || 0;
    const cover   = options.cover   || false;
    const offsetX = options.offsetX || 0;
    const offsetY = options.offsetY || 0;
    // Calculate the available space on the canvas, and its aspect ratio
    const fullWidth  = canvas.width  - (margin*2);
    const fullHeight = canvas.height - (margin*2);
    const aspectRatio = fullWidth / fullHeight;
    // Calculate dimensions at which to draw the image.
    const resourceRatio = sourceImage.width / sourceImage.height;
    let drawWidth;
    let drawHeight;
    let setWidthEqual = (resourceRatio > aspectRatio);
    if(cover){
        setWidthEqual = !setWidthEqual;
    }
    if(setWidthEqual){
        drawWidth = fullWidth;
        drawHeight = drawWidth / resourceRatio;
    } else {
        drawHeight = fullHeight;
        drawWidth = resourceRatio * drawHeight;
    }
    // Calculate the offset at which the resized image will be centered
    let drawOffsetX = ((fullWidth  - drawWidth ) / 2)+margin;
    let drawOffsetY = ((fullHeight - drawHeight) / 2)+margin;
    // Apply specified offset (useful for slight thinkess effect)
    if(offsetX){ drawOffsetX += offsetX;}
    if(offsetY){ drawOffsetY += offsetY;}
    // Draw image
    context.drawImage(
        sourceImage,
        drawOffsetX, drawOffsetY, drawWidth, drawHeight,
    );
}

//-- Draw an unscratched scratching layer --------
export function createScratchLayer(drawingState) {
    /* Onto the compositing context, draw full black everywhere except
        within the bounds of the country, which remain transparent. As the
        user scratches the country, the transparent region will be filled
        with black pixels.
    */
    const compositingContext = drawingState.compositingContext;
    const canvas = compositingContext.canvas;
    // First center image of country, then overlay black using 'source-out'
    compositingContext.save();
    compositingContext.clearRect(0, 0, canvas.width, canvas.height);
    centerImage(drawingState.imageMap, compositingContext, {
        margin: OUTLINE_WIDTH,
    });
    compositingContext.globalCompositeOperation = 'source-out';
    compositingContext.fillStyle = 'black';
    compositingContext.fillRect(0, 0, canvas.width, canvas.height);
    compositingContext.restore();
}

//-- Overlay scratch layer onto display context --
export function drawScratchOverlay(drawingState) {
    const mainContext = drawingState.mainContext;
    const compositingContext = drawingState.compositingContext;
    const canvas = compositingContext.canvas;
    // Get scratch amount data
    const scratchData = compositingContext.getImageData(
        0, 0, canvas.width, canvas.height,
    );
    compositingContext.save();
    // Draw shadow layer onto MAIN CONTEXT
    mainContext.save();
    mainContext.globalCompositeOperation = 'source-atop';
    compositingContext.globalCompositeOperation = 'source-out';
    compositingContext.fillStyle = 'black';
    compositingContext.fillRect(0, 0, canvas.width, canvas.height);
    centerImage(canvas, mainContext);
    // Draw flag onto composite context
    compositingContext.globalCompositeOperation = 'source-atop';
    centerImage(drawingState.imageFlag, compositingContext, {
        cover: true,
    });
    // Draw composite onto MAIN CONTEXT
    centerImage(canvas, mainContext, {
        offsetX:  0,
        offsetY: -1,
    });
    // Replace Scratch amount data
    mainContext.restore();
    compositingContext.restore();
    compositingContext.putImageData(scratchData, 0, 0);
}

//-- Erase a line across the scratch layer -------
export function eraseScratchLine(drawingState, startX, startY, endX, endY) {
    const compositingContext = drawingState.compositingContext;
    // Draw a line on compositing canvas from start(x,y) to end(x,y)
    compositingContext.strokeStyle = 'black';
    compositingContext.lineWidth = SCRATCH_LINE_WIDTH;
    compositingContext.beginPath();
    compositingContext.moveTo(startX, startY);
    compositingContext.lineTo(endX, endY);
    compositingContext.closePath();
    compositingContext.stroke();
}

//-- Count the number of pixels not scratched ----
export function unscratchedPixelCount(drawingState){
    const compositingContext = drawingState.compositingContext;
    // Define basic metrics and get imageData from compositingCanvas
    const canvasWidth  = compositingContext.canvas.width ;
    const canvasHeight = compositingContext.canvas.height;
    const scratchData = compositingContext.getImageData(
        0, 0, canvasWidth, canvasHeight,
    ).data;
    const pixelWidth = 4; // 4 channels, rgba, for each pixel of imageData
    const pixelCount = canvasWidth*canvasHeight;
    // count each pixel of compositing canvas not yet changed (scratched)
    let unscratchedPixels = 0
    for(let pixelNumber = 0; pixelNumber < pixelCount; pixelNumber++) {
        // Find index offset from pixel number
        const pixelOffset = pixelNumber * pixelWidth;
        // we only check the alpha channel, index 3, for unscratched pixels
        const alphaValue = scratchData[pixelOffset+3];
        if(alphaValue === 0){
            unscratchedPixels++;
        }
    }
    // Return unscratched pixel count
    return unscratchedPixels;
}

//-- Erase the entire scratch layer --------------
export function scratchAll(drawingState) {
    const compositingContext = drawingState.compositingContext;
    // Scratch off entire canvas by filling compositingContext with black;
    compositingContext.save();
    compositingContext.fillStyle = 'black';
    compositingContext.fillRect(
        0, 0,
        compositingContext.canvas.width, compositingContext.canvas.height,
    );
    compositingContext.restore();
}


//== Interaction ===============================================================

//-- Respond to user touch events ----------------
export function coordinatesOfTouch(touchEvent, canvas) {
    // Prevent the user from scrolling the page while scratching
    touchEvent.preventDefault();
    // Only consider the first instance of a moving touch as a scratch
    touchEvent = touchEvent.changedTouches[0];
    // Handle touchEvent same as mouseEvent
    return this.coordinatesOfMouse(touchEvent, canvas);
}

//-- Respond to user mouse movements -------------
export function coordinatesOfMouse(mouseEvent, canvas) {
    // Calculate coordinates of event relativee to the canvas
    const bounds = canvas.getBoundingClientRect();
    return {
        x: mouseEvent.clientX - bounds.left,
        y: mouseEvent.clientY - bounds.top ,
    };
}

//-- Check if all the map has been scratched -----
export function checkCompletion(drawingState) {
    // Calculate percentage of canvas still unscratched.
    const itchyPixels = unscratchedPixelCount(drawingState);
    const itchyRatio = itchyPixels / drawingState.itchyPixels;
    // Check if ratio is below the threshold to be considered complete
    if(itchyRatio < COMPLETION_PIXEL_RATIO){
        return true;
    }
}