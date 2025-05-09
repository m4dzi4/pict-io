'use client';
import { ReactSketchCanvas } from "react-sketch-canvas";
import { useRef, useState } from "react";

export default function CanvasPage() {
    const canvasRef = useRef(null);
    const [eraseMode, setEraseMode] = useState(false);
    const [strokeWidth, setStrokeWidth] = useState(5);
    const [eraserWidth, setEraserWidth] = useState(10);
    const [strokeColor, setStrokeColor] = useState("#000000");
    const [canvasColor, setCanvasColor] = useState("#ffffff");
    const [readOnly, setReadOnly] = useState(false);

    const handleEraserClick = () => {
        setEraseMode(true);
        canvasRef.current?.eraseMode(true);
    };

    const handlePenClick = () => {
        setEraseMode(false);
        canvasRef.current?.eraseMode(false);
    };

    const handleStrokeWidthChange = (event) => {
        setStrokeWidth(+event.target.value);
    };
    
      const handleEraserWidthChange = (event) => {
        setEraserWidth(+event.target.value);
    };

    const handleStrokeColorChange = (event) => {
        setStrokeColor(event.target.value);
    };

    const handleCanvasColorChange = (event) => {
        setCanvasColor(event.target.value);
    };

    const handleReadOnlyChange = (event) => {
        setReadOnly(event.target.checked);
    }

    const handleUndoClick = () => {
    canvasRef.current?.undo();
    };

    const handleRedoClick = () => {
    canvasRef.current?.redo();
    };

    const handleClearClick = () => {
    canvasRef.current?.clearCanvas();
    };

    const handleResetClick = () => {
    canvasRef.current?.resetCanvas();
    };

    return (
        <div className="d-flex flex-column gap-2 p-2">
            <h1>Tools</h1>
            <div className="d-flex gap-2 align-items-center ">
            <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            id="readOnly"
            checked={readOnly}
            onChange={handleReadOnlyChange}
            />
            <label className="form-check-label" htmlFor="readOnly">
                readOnly - Disables drawing
            </label>
            <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            disabled={!eraseMode}
            onClick={handlePenClick}
            >
            Pen
            </button>
            <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            disabled={eraseMode}
            onClick={handleEraserClick}
            >
            Eraser
            </button>
            <label htmlFor="strokeWidth" className="form-label">
            Stroke width
            </label>
            <input
            disabled={eraseMode}
            type="range"
            className="form-range"
            min="1"
            max="20"
            step="1"
            id="strokeWidth"
            value={strokeWidth}
            onChange={handleStrokeWidthChange}
            />
            <label htmlFor="eraserWidth" className="form-label">
            Eraser width
            </label>
            <input
            disabled={!eraseMode}
            type="range"
            className="form-range"
            min="1"
            max="20"
            step="1"
            id="eraserWidth"
            value={eraserWidth}
            onChange={handleEraserWidthChange}
            />
            <label htmlFor="color">Stroke color</label>
            <input
                type="color"
                value={strokeColor}
                onChange={handleStrokeColorChange}
            />
            <label htmlFor="color">Canvas color</label>
            <input
                type="color"
                value={canvasColor}
                onChange={handleCanvasColorChange}
                />
            </div>
            <div className="d-flex gap-2 align-items-center ">
            <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={handleUndoClick}
            >
            Undo
            </button>
            <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={handleRedoClick}
            >
            Redo
            </button>
            <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={handleClearClick}
            >
            Clear
            </button>
            <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={handleResetClick}
            >
            Reset
            </button>

            </div>
            <h1>Canvas</h1>
            {/* Add a wrapper div for positioning the overlay */}
            <div style={{ position: 'relative', width: '700px', height: '400px' }}>
                <ReactSketchCanvas
                    // The readOnly prop is still passed, in case the inner component uses it
                    readOnly={readOnly}
                    ref={canvasRef}
                    strokeColor={strokeColor}
                    canvasColor={canvasColor}
                    strokeWidth={strokeWidth}
                    eraserWidth={eraserWidth}
                    width="700px" // Ensure these match the parent div if not 100%
                    height="400px"
                />
                {/* Conditionally render the overlay when readOnly is true */}
                {readOnly && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '0px',     // Move 2px up
                            left: '0px',    // Move 2px to the left
                            width: '105%', // Cover the full width of the parent
                            height: '105%', // Cover the full height of the parent
                            zIndex: 10, // Ensure it's on top of the canvas
                            // backgroundColor: 'rgba(0,0,0,0.01)', // Optional: for debugging visibility
                        }}
                        title="Canvas is in read-only mode" // For accessibility
                    />
                )}
            </div>
        </div>
    );
}
