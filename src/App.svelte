<script>
  import { calculateRankings, generateId, sanitizeRanking, validateVote } from './lib/ranking.js'
  
  let options = [
    { id: generateId(), name: '选项 A' },
    { id: generateId(), name: '选项 B' },
    { id: generateId(), name: '选项 C' }
  ]
  
  let users = [
    { id: 'user1', name: '用户 1' },
    { id: 'user2', name: '用户 2' },
    { id: 'user3', name: '用户 3' }
  ]
  
  let rawVotes = {}
  let voteHistory = []
  let newOptionName = ''
  let newUserName = ''
  let selectedUser = 'user1'
  let autoNormalizeEnabled = true
  
  users.forEach(user => {
    rawVotes[user.id] = options.map(opt => opt.id)
  })
  
  $: normalizedData = deriveNormalizedData(options, users, rawVotes)
  $: normalizedVotes = normalizedData.normalizedVotes
  $: voteValidations = normalizedData.validations
  
  $: voteList = Object.entries(normalizedVotes).map(([userId, ranking]) => ({
    userId,
    userName: users.find(u => u.id === userId)?.name || userId,
    ranking
  }))
  
  $: rankings = calculateRankings(options, voteList)
  
  $: hasValidationErrors = Object.values(voteValidations).some(v => !v.valid)
  
  $: totalValidationErrors = Object.values(voteValidations).reduce(
    (count, v) => count + (v.errors?.length || 0), 0
  )
  
  function deriveNormalizedData(currentOptions, currentUsers, currentRawVotes) {
    const result = {
      normalizedVotes: {},
      validations: {}
    }
    
    if (!Array.isArray(currentOptions) || !Array.isArray(currentUsers)) {
      return result
    }
    
    currentUsers.forEach(user => {
      const rawRanking = currentRawVotes?.[user.id] || []
      const normalizedRanking = sanitizeRanking(rawRanking, currentOptions.map(opt => opt.id))
      const validation = validateVote({ ranking: rawRanking }, currentOptions)
      
      result.normalizedVotes[user.id] = normalizedRanking
      result.validations[user.id] = validation
    })
    
    return result
  }
  
  function addOption() {
    if (!newOptionName.trim()) return
    
    const newOption = { id: generateId(), name: newOptionName.trim() }
    const newRawVotes = { ...rawVotes }
    
    Object.keys(newRawVotes).forEach(userId => {
      newRawVotes[userId] = [...newRawVotes[userId], newOption.id]
    })
    
    options = [...options, newOption]
    rawVotes = newRawVotes
    
    recordHistory('添加候选项', newOption.name)
    newOptionName = ''
  }
  
  function removeOption(optionId) {
    const option = options.find(o => o.id === optionId)
    if (!option) return
    
    const newOptions = options.filter(o => o.id !== optionId)
    const newRawVotes = { ...rawVotes }
    
    Object.keys(newRawVotes).forEach(userId => {
      newRawVotes[userId] = newRawVotes[userId].filter(id => id !== optionId)
    })
    
    options = newOptions
    rawVotes = newRawVotes
    
    recordHistory('删除候选项', option.name)
  }
  
  function addUser() {
    if (!newUserName.trim()) return
    
    const newUser = { id: generateId(), name: newUserName.trim() }
    const newRawVotes = { ...rawVotes }
    newRawVotes[newUser.id] = options.map(opt => opt.id)
    
    users = [...users, newUser]
    rawVotes = newRawVotes
    
    recordHistory('添加用户', newUser.name)
    newUserName = ''
    selectedUser = newUser.id
  }
  
  function removeUser(userId) {
    const user = users.find(u => u.id === userId)
    if (!user) return
    
    const newUsers = users.filter(u => u.id !== userId)
    const newRawVotes = { ...rawVotes }
    delete newRawVotes[userId]
    
    users = newUsers
    rawVotes = newRawVotes
    
    if (selectedUser === userId && newUsers.length > 0) {
      selectedUser = newUsers[0].id
    }
    
    recordHistory('删除用户', user.name)
  }
  
  function handleDragStart(userId, optionId, event) {
    event.dataTransfer.setData('text/plain', JSON.stringify({ userId, optionId }))
  }
  
  function handleDragOver(event) {
    event.preventDefault()
  }
  
  function handleDrop(targetUserId, targetOptionId, event) {
    event.preventDefault()
    const data = JSON.parse(event.dataTransfer.getData('text/plain'))
    const { userId: draggedUserId, optionId: draggedOptionId } = data
    
    if (draggedUserId !== targetUserId) return
    
    const ranking = rawVotes[draggedUserId] || []
    const fromIndex = ranking.indexOf(draggedOptionId)
    const toIndex = ranking.indexOf(targetOptionId)
    
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    
    const newRanking = [...ranking]
    newRanking.splice(fromIndex, 1)
    newRanking.splice(toIndex, 0, draggedOptionId)
    
    const newRawVotes = { ...rawVotes, [draggedUserId]: newRanking }
    rawVotes = newRawVotes
    
    const user = users.find(u => u.id === draggedUserId)
    recordHistory('调整投票顺序', `${user?.name} 的投票顺序`)
  }
  
  function fixValidationErrors(userId) {
    const validation = voteValidations[userId]
    if (!validation || validation.valid) return
    
    const oldRanking = [...rawVotes[userId]]
    const newRawVotes = { ...rawVotes, [userId]: [...validation.ranking] }
    rawVotes = newRawVotes
    
    const user = users.find(u => u.id === userId)
    const oldStr = formatRankingForDisplay(oldRanking, options)
    const newStr = formatRankingForDisplay(validation.ranking, options)
    
    recordHistory('修复投票数据', `${user?.name}: ${oldStr} → ${newStr}`)
  }
  
  function fixAllValidationErrors() {
    const newRawVotes = { ...rawVotes }
    let hasChanges = false
    
    users.forEach(user => {
      const validation = voteValidations[user.id]
      if (validation && !validation.valid) {
        newRawVotes[user.id] = [...validation.ranking]
        hasChanges = true
      }
    })
    
    if (hasChanges) {
      rawVotes = newRawVotes
      recordHistory('一键修复', `修复了 ${totalValidationErrors} 个数据问题`)
    }
  }
  
  function recordHistory(action, detail) {
    voteHistory = [
      {
        id: generateId(),
        timestamp: new Date().toLocaleString('zh-CN'),
        action,
        detail
      },
      ...voteHistory.slice(0, 99)
    ]
  }
  
  function getOptionName(optionId, optionsParam = options) {
    return optionsParam.find(o => o.id === optionId)?.name || `未知(${optionId})`
  }
  
  function formatRankingForDisplay(ranking, optionsParam = options) {
    if (!ranking) return '无'
    return ranking.map(id => getOptionName(id, optionsParam)).join(' → ')
  }
  
  function formatRanking(ranking) {
    return formatRankingForDisplay(ranking, options)
  }
  
  function getRankingDisplayForUser(userId) {
    if (autoNormalizeEnabled) {
      return normalizedVotes[userId] || []
    }
    return rawVotes[userId] || []
  }
</script>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 20px;
  }
  
  .app {
    max-width: 1400px;
    margin: 0 auto;
  }
  
  h1 {
    color: white;
    text-align: center;
    margin-bottom: 30px;
    font-size: 2.5rem;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  }
  
  .grid {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    gap: 20px;
  }
  
  .column {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
  
  .column h2 {
    margin-top: 0;
    color: #333;
    border-bottom: 2px solid #667eea;
    padding-bottom: 10px;
  }
  
  .add-item {
    display: flex;
    gap: 8px;
    margin-bottom: 15px;
  }
  
  .add-item input {
    flex: 1;
    padding: 8px 12px;
    border: 2px solid #e0e0e0;
    border-radius: 6px;
    font-size: 14px;
    transition: border-color 0.3s;
  }
  
  .add-item input:focus {
    outline: none;
    border-color: #667eea;
  }
  
  .add-item button {
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: transform 0.2s;
  }
  
  .add-item button:hover {
    transform: translateY(-2px);
  }
  
  .item-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #f8f9fa;
    border-radius: 6px;
    margin-bottom: 8px;
    transition: background 0.3s;
  }
  
  .item:hover {
    background: #e9ecef;
  }
  
  .item button {
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
  }
  
  .item button:hover {
    background: #c82333;
  }
  
  .user-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
  }
  
  .user-tab {
    padding: 8px 16px;
    background: #e9ecef;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .user-tab.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  
  .user-tab:hover:not(.active) {
    background: #dee2e6;
  }
  
  .error-badge {
    background: #dc3545;
    color: white;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
  }
  
  .ranking-list {
    list-style: none;
    padding: 0;
    margin: 0;
    min-height: 200px;
  }
  
  .ranking-item {
    display: flex;
    align-items: center;
    padding: 12px 15px;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    border-radius: 8px;
    margin-bottom: 10px;
    cursor: grab;
    user-select: none;
    transition: all 0.3s;
    border: 2px solid transparent;
  }
  
  .ranking-item:hover {
    transform: translateX(5px);
    border-color: #667eea;
  }
  
  .ranking-item:active {
    cursor: grabbing;
  }
  
  .rank-number {
    width: 30px;
    height: 30px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    margin-right: 15px;
    font-size: 14px;
  }
  
  .ranking-item-name {
    flex: 1;
    font-weight: 600;
    color: #333;
  }
  
  .drag-handle {
    color: #999;
    font-size: 20px;
    padding: 0 5px;
  }
  
  .rankings-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .rankings-item {
    display: flex;
    align-items: center;
    padding: 12px 15px;
    margin-bottom: 10px;
    border-radius: 8px;
    transition: all 0.3s;
  }
  
  .rankings-item.gold {
    background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  }
  
  .rankings-item.silver {
    background: linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%);
  }
  
  .rankings-item.bronze {
    background: linear-gradient(135deg, #cd7f32 0%, #daa520 100%);
  }
  
  .rankings-item.normal {
    background: #f8f9fa;
  }
  
  .rankings-item-name {
    flex: 1;
    font-weight: 600;
    color: #333;
  }
  
  .rank-badge {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    margin-right: 15px;
    font-size: 16px;
    background: white;
    color: #333;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  .score {
    font-size: 14px;
    color: #666;
    font-weight: 500;
  }
  
  .tied {
    display: inline-block;
    margin-left: 5px;
    padding: 2px 6px;
    background: #ffc107;
    color: #333;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .history-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .history-item {
    padding: 10px 12px;
    border-left: 3px solid #667eea;
    margin-bottom: 8px;
    background: #f8f9fa;
    border-radius: 0 6px 6px 0;
  }
  
  .history-action {
    font-weight: 600;
    color: #333;
    margin-bottom: 2px;
  }
  
  .history-detail {
    font-size: 13px;
    color: #666;
  }
  
  .history-time {
    font-size: 11px;
    color: #999;
    margin-top: 2px;
  }
  
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #999;
  }
  
  .instructions {
    background: #e7f3ff;
    border-left: 4px solid #2196f3;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 20px;
    font-size: 13px;
    color: #333;
  }
  
  .validation-alert {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 15px;
  }
  
  .validation-alert-title {
    font-weight: 600;
    color: #856404;
    margin-bottom: 8px;
  }
  
  .validation-errors {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    color: #856404;
  }
  
  .validation-errors li {
    margin-bottom: 4px;
  }
  
  .fix-button {
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    margin-top: 8px;
    transition: background 0.2s;
  }
  
  .fix-button:hover {
    background: #218838;
  }
  
  .fix-all-button {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    width: 100%;
    margin-top: 10px;
    transition: transform 0.2s;
  }
  
  .fix-all-button:hover {
    transform: translateY(-1px);
  }
  
  .data-source-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    margin-left: 8px;
  }
  
  .data-source-badge.normalized {
    background: #d4edda;
    color: #155724;
  }
  
  .data-source-badge.raw {
    background: #f8d7da;
    color: #721c24;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .toggle-switch {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #666;
  }
  
  .toggle-switch input[type="checkbox"] {
    cursor: pointer;
  }
  
  .normalized-indicator {
    background: #d4edda;
    border: 1px solid #28a745;
    border-radius: 4px;
    padding: 8px 12px;
    margin-bottom: 15px;
    font-size: 13px;
    color: #155724;
  }
  
  .raw-indicator {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 4px;
    padding: 8px 12px;
    margin-bottom: 15px;
    font-size: 13px;
    color: #856404;
  }
  
  @media (max-width: 1024px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>

<div class="app">
  <h1>🎯 投票排序看板</h1>
  
  <div class="grid">
    <div class="column">
      <h2>📋 候选项管理</h2>
      
      <div class="add-item">
        <input 
          type="text" 
          bind:value={newOptionName}
          placeholder="输入新候选项名称"
          on:keydown={(e) => e.key === 'Enter' && addOption()}
        />
        <button on:click={addOption}>添加</button>
      </div>
      
      {#if options.length === 0}
        <div class="empty-state">暂无候选项，请添加</div>
      {:else}
        <ul class="item-list">
          {#each options as option}
            <li class="item">
              <span>{option.name}</span>
              <button on:click={() => removeOption(option.id)}>删除</button>
            </li>
          {/each}
        </ul>
      {/if}
      
      <h2 style="margin-top: 30px;">👥 用户管理</h2>
      
      <div class="add-item">
        <input 
          type="text" 
          bind:value={newUserName}
          placeholder="输入新用户名称"
          on:keydown={(e) => e.key === 'Enter' && addUser()}
        />
        <button on:click={addUser}>添加</button>
      </div>
      
      {#if users.length === 0}
        <div class="empty-state">暂无用户，请添加</div>
      {:else}
        <ul class="item-list">
          {#each users as user}
            <li class="item">
              <span>{user.name}</span>
              {#if users.length > 1}
                <button on:click={() => removeUser(user.id)}>删除</button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
      
      <h2 style="margin-top: 30px;">⚙️ 数据设置</h2>
      <div class="toggle-switch">
        <input type="checkbox" bind:checked={autoNormalizeEnabled} id="auto-normalize" />
        <label for="auto-normalize">自动规范化数据</label>
      </div>
      
      {#if hasValidationErrors}
        <button class="fix-all-button" on:click={fixAllValidationErrors}>
          🔧 一键修复所有数据问题 ({totalValidationErrors} 个错误)
        </button>
      {/if}
    </div>
    
    <div class="column">
      <div class="section-header">
        <h2>🗳️ 用户投票</h2>
        {#if autoNormalizeEnabled}
          <span class="data-source-badge normalized">已规范化</span>
        {:else}
          <span class="data-source-badge raw">原始数据</span>
        {/if}
      </div>
      
      {#if autoNormalizeEnabled}
        <div class="normalized-indicator">
          ✅ 所有投票数据已自动规范化，综合排名基于规范后的数据计算
        </div>
      {:else}
        <div class="raw-indicator">
          ⚠️ 当前显示原始投票数据，综合排名仍基于规范化数据
        </div>
      {/if}
      
      <div class="instructions">
        💡 提示：拖拽候选项可以调整偏好顺序，排名越靠前得分越高
      </div>
      
      {#if users.length === 0}
        <div class="empty-state">请先添加用户</div>
      {:else if options.length === 0}
        <div class="empty-state">请先添加候选项</div>
      {:else}
        <div class="user-selector">
          {#each users as user}
            {@const hasError = voteValidations[user.id] && !voteValidations[user.id].valid}
            <button 
              class="user-tab {selectedUser === user.id ? 'active' : ''}"
              on:click={() => selectedUser = user.id}
            >
              {user.name}
              {#if hasError}
                <span class="error-badge">{voteValidations[user.id].errors.length}</span>
              {/if}
            </button>
          {/each}
        </div>
        
        {#each users as user}
          {#if selectedUser === user.id}
            {@const displayRanking = getRankingDisplayForUser(user.id)}
            {@const validation = voteValidations[user.id]}
            
            {#if validation && !validation.valid}
              <div class="validation-alert">
                <div class="validation-alert-title">
                  ⚠️ 该用户投票存在 {validation.errors.length} 个问题
                </div>
                <ul class="validation-errors">
                  {#each validation.errors as error}
                    <li>{error}</li>
                  {/each}
                </ul>
                {#if autoNormalizeEnabled}
                  <div style="font-size: 12px; color: #856404; margin-top: 8px;">
                    ℹ️ 综合排名已自动使用规范化后的数据计算
                  </div>
                {/if}
                <button class="fix-button" on:click={() => fixValidationErrors(user.id)}>
                  🔧 修复并应用规范化数据
                </button>
              </div>
            {/if}
            
            <h3 style="margin-top: 0;">{user.name} 的偏好排序：</h3>
            <ul class="ranking-list">
              {#each displayRanking as optionId, index}
                {@const option = options.find(o => o.id === optionId)}
                <li 
                  class="ranking-item"
                  draggable="true"
                  on:dragstart={(e) => handleDragStart(user.id, optionId, e)}
                  on:dragover={handleDragOver}
                  on:drop={(e) => handleDrop(user.id, optionId, e)}
                >
                  <span class="rank-number">{index + 1}</span>
                  <span class="ranking-item-name">
                    {option?.name || `未知(${optionId})`}
                    {#if !option}
                      <span style="color: #dc3545; font-size: 12px;">(无效ID)</span>
                    {/if}
                  </span>
                  <span class="drag-handle">⋮⋮</span>
                </li>
              {/each}
            </ul>
          {/if}
        {/each}
      {/if}
      
      <h2 style="margin-top: 30px;">📜 投票变更历史</h2>
      
      {#if voteHistory.length === 0}
        <div class="empty-state">暂无变更记录</div>
      {:else}
        <ul class="history-list">
          {#each voteHistory as history}
            <li class="history-item">
              <div class="history-action">{history.action}</div>
              <div class="history-detail">{history.detail}</div>
              <div class="history-time">{history.timestamp}</div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    
    <div class="column">
      <h2>🏆 综合排名</h2>
      
      <div class="instructions">
        <strong>排名规则：</strong><br/>
        1. 使用 Borda 计数法计算得分<br/>
        2. 分数相同比较第一名次数<br/>
        3. 仍相同按名称字母排序
      </div>
      
      {#if options.length === 0}
        <div class="empty-state">暂无候选项</div>
      {:else}
        <ul class="rankings-list">
          {#each rankings as item}
            {@const rankClass = item.rank === 1 ? 'gold' : item.rank === 2 ? 'silver' : item.rank === 3 ? 'bronze' : 'normal'}
            {@const hasTie = rankings.filter(r => r.rank === item.rank && r.id !== item.id).length > 0}
            <li class="rankings-item {rankClass}">
              <span class="rank-badge">#{item.rank}</span>
              <span class="rankings-item-name">
                {item.name}
                {#if hasTie}
                  <span class="tied">并列</span>
                {/if}
              </span>
              <span class="score">{item.score} 分</span>
            </li>
          {/each}
        </ul>
        
        {#if normalizedVotes && Object.keys(normalizedVotes).length > 0}
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
            <h3 style="margin-bottom: 10px;">各用户投票详情（已规范化）：</h3>
            {#each users as user}
              {#if normalizedVotes[user.id]}
                {@const validation = voteValidations[user.id]}
                <div style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px; {validation && !validation.valid ? 'border-left: 3px solid #ffc107;' : ''}">
                  <strong>{user.name}:</strong>
                  {#if validation && !validation.valid}
                    <span style="font-size: 11px; color: #856404; margin-left: 8px;">(已规范化)</span>
                  {/if}
                  <br/>
                  <small style="color: #666;">{formatRanking(normalizedVotes[user.id])}</small>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>
