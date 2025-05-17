'use client';
import React from 'react';

export default function CreateRoomModal({ 
  settings, 
  setNewRoomSettings, 
  onClose, 
  onSubmit 
}) {
  return (
    <div>
      <h3>Create Room Settings</h3>
      <div>
        <label>
          Max Players:
          <input
            type="number"
            value={settings.maxPlayers}
            onChange={e => setNewRoomSettings(prev => ({
              ...prev,
              maxPlayers: parseInt(e.target.value, 10) || 2
            }))}
            min="2"
            max="16"
          />
        </label>
      </div>
      <div>
        <label>
          Game Mode:
          <select
            value={settings.gameMode}
            onChange={e => setNewRoomSettings(prev => ({
              ...prev,
              gameMode: e.target.value
            }))}
          >
            <option value="rounds">Fixed Number of Rounds</option>
            <option value="points">First to X Points</option>
          </select>
        </label>
      </div>
      {settings.gameMode === 'rounds' ? (
        <div>
          <label>
            Number of Rounds:
            <input
              type="number"
              value={settings.maxRounds}
              onChange={e => setNewRoomSettings(prev => ({
                ...prev,
                maxRounds: parseInt(e.target.value, 10) || 1
              }))}
              min="1"
              max="20"
            />
          </label>
        </div>
      ) : (
        <div>
          <label>
            Points to Win:
            <input
              type="number"
              value={settings.pointsToWin}
              onChange={e => setNewRoomSettings(prev => ({
                ...prev,
                pointsToWin: parseInt(e.target.value, 10) || 1
              }))}
              min="1"
              max="10"
            />
          </label>
        </div>
      )}
      <div>
        <label>
          Round Time Limit (seconds):
          <input
            type="number"
            value={settings.roundDuration}
            onChange={e => setNewRoomSettings(prev => ({
              ...prev,
              roundDuration: parseInt(e.target.value, 10) || 30
            }))}
            min="30"
            max="300"
            step="10"
          />
        </label>
      </div>
      <div>
        <label>
          Drawer Selection Method:
          <select
            value={settings.drawerChoice}
            onChange={e => setNewRoomSettings(prev => ({
              ...prev,
              drawerChoice: e.target.value
            }))}
          >
            <option value="random">Random Each Round</option>
            <option value="queue">Take Turns in Queue</option>
            <option value="winner">Winner Becomes Drawer</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          <input
            type="checkbox"
            checked={settings.isPrivate}
            onChange={e => setNewRoomSettings(prev => ({
              ...prev,
              isPrivate: e.target.checked,
              accessCode: e.target.checked ? prev.accessCode : ''
            }))}
          />
          Private Room
        </label>
      </div>
      {settings.isPrivate && (
        <div>
          <label>
            Access Code (optional):
            <input
              type="text"
              value={settings.accessCode}
              onChange={e => setNewRoomSettings(prev => ({
                ...prev,
                accessCode: e.target.value.toUpperCase()
              }))}
              placeholder="e.g., MYCODE"
            />
          </label>
        </div>
      )}
      <button onClick={onClose}>Cancel</button>
      <button onClick={onSubmit}>Create & Start</button>
    </div>
  );
}