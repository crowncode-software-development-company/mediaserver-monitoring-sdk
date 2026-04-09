# Media Server Viewer SDK

Библиотека для мониторинга и просмотра видео-потоков (камер) в реальном времени через протокол WebRTC.


## Быстрый старт

### 1. Подключение к сессии
Для работы с SDK вам потребуется **Токен доступа**, который выдается сервером.

```typescript
import { MediaClient } from '@mediaserver/media-client';

const client = new MediaClient();
const session = client.initSession();

// 1. Подписываемся на появление новых камер
session.on('streamCreated', (event) => {
    console.log('Появилась новая камера:', event.stream.streamId);
    
    // 2. Подписываемся на поток
    const subscriber = session.subscribe(event.stream);
    
    // 3. Привязываем видео-элемент
    subscriber.addVideoElement(document.getElementById('video-grid')!);
});

// 4. Подключаемся
await session.connect(YOUR_TOKEN);
```

---

## Формат Токена (Token)

Токен представляет собой строку, содержащую адрес сервера и параметры доступа. Формат:
`wss://<domain>?sessionId=<id>&secret=<key>`

- **wss/ws**: Протокол соединения 
- **sessionId**: Идентификатор сессии, к которой вы подключаетесь.
- **secret**: Ключ авторизации для доступа к потокам.

---

## API Reference

### Класс `Session` (События)

Используйте метод `.on(eventName, callback)` для подписки на события жизненного цикла.

| Событие | Описание | Аргументы |
| :--- | :--- | :--- |
| `streamCreated` | Вызывается при появлении новой камеры в сессии. | `{ stream: Stream }` |
| `streamDestroyed` | Вызывается, когда камера отключается. | `{ stream: Stream }` |
| `connectionCreated` | Вызывается при установке нового соединения. | `{ connection: Connection }` |
| `reconnecting` | Попытка восстановить разорванное соединение. | - |
| `reconnected` | Успешное восстановление связи. | - |
| `error` | Критическая ошибка сессии. | `Error` |

### Класс `Subscriber` (Методы)

Объект, возвращаемый методом `session.subscribe()`.

- **`addVideoElement(target: HTMLElement | string)`**: Создает и добавляет `<video>` элемент в указанный контейнер.
- **`on(event, callback)`**: Подписка на события конкретного подписчика (например, `streamPlaying`).

---

## Best Practices

### Автоматическая подписка
Для систем мониторинга рекомендуется подписываться на все входящие потоки сразу после их создания:

```typescript
session.on('streamCreated', ({ stream }) => {
    session.subscribe(stream);
});
```

---

## Разработка

- `npm install` — установка зависимостей.
- `npm run build` — сборка SDK (результат в папке `dist`).
- `npm run dev` — запуск в режиме разработки.
