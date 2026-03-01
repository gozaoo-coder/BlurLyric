import baseMethods from '../../../js/baseMethods';

/**
 * 创建音乐表格的右键菜单配置
 * @param {Object} params - 菜单依赖的参数
 * @returns {Array} 菜单配置数组
 */
export function createMusicTableMenuItems(params) {
  const {
    line,
    line_index,
    currentTable,
    pushMusic,
    coverMusicTrack,
    nextMusic,
    musicTrack,
    setSortCondition,
    regMessage
  } = params;

  // 获取艺术家名称字符串
  const getArtistsString = (ar) => {
    if (!ar || !Array.isArray(ar)) return '';
    return ar.map(artist => artist.name).join('&');
  };

  // 播放操作菜单
  const playMenuItems = [
    {
      iconClass: ['bi', 'bi-vinyl'],
      name: '播放该列表',
      handleClick: () => {
        coverMusicTrack(currentTable.value.cellArray, line_index);
        regMessage?.({
          type: 'Message',
          content: `开始播放列表《${currentTable.value.cellArray[0]?.al?.name || '未知列表'}》`
        });
      }
    },
    {
      iconClass: ['bi', 'bi-skip-forward-circle'],
      name: '下一首播放',
      handleClick: () => {
        // 在当前播放索引后插入
        const currentIndex = musicTrack.value?.findIndex?.(m => m.id === line.id) ?? -1;
        if (currentIndex === -1) {
          // 如果歌曲不在列表中，添加到下一首
          const insertIndex = (musicTrack.value?.length || 0) > 0 ? 1 : 0;
          musicTrack?.value?.splice?.(insertIndex, 0, line);
        }
        regMessage?.({
          type: 'Message',
          content: `《${line.name}》已设置为下一首播放`
        });
      }
    },
    {
      iconClass: ['bi', 'bi-plus-circle'],
      name: '加入播放列表末',
      handleClick: () => {
        pushMusic(line);
      }
    }
  ];

  // 复制操作菜单
  const copyMenuItems = [
    {
      iconClass: ['bi', 'bi-justify-left'],
      name: '一键复制',
      handleClick: () => {
        const artists = getArtistsString(line.ar);
        const text = `歌曲：${line.name}\n艺术家：${artists}\n专辑：${line.al?.name || '未知专辑'}`;
        baseMethods.copy(text);
        regMessage?.({
          type: 'Message',
          content: '已复制歌曲完整信息到剪贴板'
        });
      }
    },
    {
      iconClass: ['bi', 'bi-music-note'],
      name: '复制 音乐名',
      handleClick: () => {
        baseMethods.copy(line.name);
        regMessage?.({
          type: 'Message',
          content: `已复制音乐名：${line.name}`
        });
      }
    },
    {
      iconClass: ['bi', 'bi-image'],
      name: '复制 图片链接',
      handleClick: () => {
        const picUrl = line.al?.picUrl || '';
        baseMethods.copy(picUrl);
        regMessage?.({
          type: 'Message',
          content: picUrl ? '已复制专辑图片链接' : '暂无图片链接'
        });
      }
    },
    {
      iconClass: ['bi', 'bi-people'],
      name: '复制 创作者名',
      handleClick: () => {
        const artists = getArtistsString(line.ar);
        baseMethods.copy(artists);
        regMessage?.({
          type: 'Message',
          content: `已复制创作者：${artists}`
        });
      }
    },
    {
      iconClass: ['bi', 'bi-disc'],
      name: '复制 专辑名',
      handleClick: () => {
        const albumName = line.al?.name || '';
        baseMethods.copy(albumName);
        regMessage?.({
          type: 'Message',
          content: `已复制专辑名：${albumName || '未知专辑'}`
        });
      }
    }
  ];

  // 排序方式菜单
  const sortMenuItems = [
    {
      name: '默认',
      handleClick: () => setSortCondition?.('default')
    },
    {
      name: '#',
      handleClick: () => setSortCondition?.('trackNumber')
    },
    {
      name: '歌名',
      handleClick: () => setSortCondition?.('name')
    },
    {
      name: '歌手',
      handleClick: () => setSortCondition?.('artist')
    },
    {
      name: '专辑',
      handleClick: () => setSortCondition?.('album')
    },
    {
      name: '时长',
      handleClick: () => setSortCondition?.('duration')
    }
  ];

  // 音乐详情菜单
  const detailMenuItems = [
    {
      iconClass: ['bi', 'bi-image'],
      name: '查看专辑图片',
      handleClick: () => {
        const picUrl = line.al?.picUrl;
        if (picUrl) {
          window.open(picUrl, '_blank');
        } else {
          regMessage?.({
            type: 'Warning',
            content: '暂无专辑图片'
          });
        }
      }
    },
    {
      iconClass: ['bi', 'bi-people'],
      name: `音乐人 ${getArtistsString(line.ar)}`,
      handleClick: () => {
        // 跳转到艺人页面
        if (line.ar?.[0]?.id && line.ar[0].id !== -2) {
          // 使用 Vue Router 导航
          const artistId = line.ar[0].id;
          regMessage?.({
            type: 'Message',
            content: `正在跳转到艺人：${line.ar[0].name}`
          });
        }
      }
    },
    {
      iconClass: ['bi', 'bi-disc'],
      name: `专辑 ${line.al?.name || '未知专辑'}`,
      handleClick: () => {
        // 跳转到专辑页面
        if (line.al?.id && line.al.id !== -2) {
          const albumId = line.al.id;
          regMessage?.({
            type: 'Message',
            content: `正在跳转到专辑：${line.al.name}`
          });
        }
      }
    },
    { type: 'hr' },
    {
      iconClass: ['bi', 'bi-info-circle'],
      name: '音乐信息',
      handleClick: () => {
        // 显示音乐详细信息
        const info = [];
        if (line.duration) {
          const minutes = Math.floor(line.duration / 60);
          const seconds = Math.floor(line.duration % 60);
          info.push(`时长: ${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
        if (line.genre) info.push(`流派: ${line.genre}`);
        if (line.year) info.push(`年份: ${line.year}`);
        if (line.composer) info.push(`作曲: ${line.composer}`);
        if (line.lyricist) info.push(`作词: ${line.lyricist}`);
        if (line.bitrate) info.push(`比特率: ${line.bitrate} kbps`);
        if (line.sampleRate) info.push(`采样率: ${line.sampleRate} Hz`);
        if (line.channels) info.push(`声道: ${line.channels}`);
        
        // 显示其他标签
        const otherTags = line.otherTags || line.other_tags;
        if (otherTags && Object.keys(otherTags).length > 0) {
          info.push('--- 其他标签 ---');
          for (const [key, value] of Object.entries(otherTags)) {
            info.push(`${key}: ${value}`);
          }
        }
        
        if (info.length > 0) {
          regMessage?.({
            type: 'Message',
            content: info.join('\n'),
            duration: 5000
          });
        } else {
          regMessage?.({
            type: 'Warning',
            content: '暂无详细信息'
          });
        }
      }
    }
  ];

  // 主菜单
  return [
    {
      iconClass: ['bi', 'bi-play-circle'],
      name: '插入单曲',
      handleClick: () => pushMusic(line)
    },
    {
      iconClass: ['bi', 'bi-music-note-list'],
      name: '其他播放操作',
      type: 'hoverMenu',
      menuItems: playMenuItems
    },
    {
      iconClass: ['bi', 'bi-clipboard'],
      name: '复制内容...',
      type: 'hoverMenu',
      menuItems: copyMenuItems
    },
    { type: 'hr' },
    {
      iconClass: ['bi', 'bi-arrow-down-up'],
      name: '排列方式',
      type: 'hoverMenu',
      menuItems: sortMenuItems
    },
    { type: 'hr' },
    {
      iconClass: ['bi', 'bi-info-circle'],
      name: '音乐详情',
      type: 'hoverMenu',
      menuItems: detailMenuItems
    },
    {
      iconClass: ['bi', 'bi-file-earmark-music'],
      name: '转存音乐文件',
      handleClick: () => {
        // 转存/下载功能
        if (line.src) {
          const link = document.createElement('a');
          link.href = line.src;
          link.download = `${line.name}.mp3`;
          link.click();
          regMessage?.({
            type: 'Message',
            content: `开始下载：${line.name}`
          });
        } else {
          regMessage?.({
            type: 'Warning',
            content: '暂无音乐文件链接'
          });
        }
      }
    },
    {
      iconClass: ['bi', 'bi-share'],
      name: '分享',
      handleClick: () => {
        // 分享功能
        const shareText = `分享音乐：${line.name} - ${getArtistsString(line.ar)}`;
        if (navigator.share) {
          navigator.share({
            title: line.name,
            text: shareText,
            url: window.location.href
          });
        } else {
          baseMethods.copy(shareText);
          regMessage?.({
            type: 'Message',
            content: '分享内容已复制到剪贴板'
          });
        }
      }
    }
  ];
}

/**
 * 表格列配置
 */
export const tableColumnConfig = [
  {
    type: 'trackOrdinalNumber',
    path: function () {
      return this.line_index + 1;
    },
    name: '#',
    sizing: 'basis',
    sizingValue: '1.75em',
    spacialStyle: {
      color: 'var(--fontColor-content-moreUnimportant)',
      fontSize: '.8em',
    }
  },
  {
    type: 'image',
    path: function () {
      return (this.line.al?.name != 'Unknown Album') ? this.line.al?.id : -2;
    },
    name: '图像',
    sizing: 'basis',
    sizingValue: '38px'
  },
  {
    type: 'content',
    path: function () {
      return this.line.name;
    },
    name: '歌曲名',
  },
  {
    type: 'content',
    path: function () {
      if (!this.line.ar || !Array.isArray(this.line.ar)) return '';
      return this.line.ar.map((ar) => ar.name).join('&');
    },
    name: '歌手',
    spacialStyle: {
      color: 'var(--fontColor-content-unimportant)',
    }
  },
  {
    type: 'content',
    path: function () {
      return this.line.al?.name || '';
    },
    name: '专辑',
    spacialStyle: {
      color: 'var(--fontColor-content-unimportant)',
    }
  },
  {
    type: 'content',
    path: function () {
      const duration = this.line.duration;
      if (!duration || duration <= 0) return '--:--';
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },
    name: '时长',
    sizing: 'basis',
    sizingValue: '4em',
    spacialStyle: {
      color: 'var(--fontColor-content-unimportant)',
      textAlign: 'right',
      justifyContent: 'flex-end',
    }
  }
];

/**
 * 排序条件配置
 */
export const sortConditions = {
  default: {
    filterFunction: () => true,
    getKey: (item) => String(item.track_number || 0),
    sortOrder: 'asc'
  },
  trackNumber: {
    filterFunction: () => true,
    getKey: (item) => String(item.track_number || 0).padStart(4, '0'),
    sortOrder: 'asc'
  },
  name: {
    filterFunction: () => true,
    getKey: (item) => item.name || '',
    sortOrder: 'asc'
  },
  artist: {
    filterFunction: () => true,
    getKey: (item) => item.ar?.[0]?.name || '',
    sortOrder: 'asc'
  },
  album: {
    filterFunction: () => true,
    getKey: (item) => item.al?.name || '',
    sortOrder: 'asc'
  },
  duration: {
    filterFunction: () => true,
    getKey: (item) => item.duration || 0,
    sortOrder: 'asc'
  }
};
