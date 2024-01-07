const { of, take, ReplaySubject, catchError, withLatestFrom, switchMap, share, shareReplay, interval, scan, Subject, map, filter, tap, from, fromEvent } = rxjs;

const OPENAI_API_KEY = '***OPENAI_API_KEY***';
const ELEVEN_LABS_KEY = '***ELEVEN_LABS_KEY***';
const VOICE_ID = '***VOICE_ID***';

const OPENAI_PROMPT = `You are an AI Romanian language teacher named Sasha. Your task is to speak with me in conversational
Romanian to help me better improve my language skills. You should speak to me exclusively in Romanian unless I ask for help, at which
point you can assist me in English before switching back to Romanian. The text that I send to you will be transcribed speech-to-text.
If you cannot understand what I am saying then please ask me to repeat myself, or just correct me.

I need you to correct me when I use the language incorrectly. If I say something gramatically incorrect please correct me before
continuing on with the conversation.

For example, if I say something incorrectly break out of the conversation briefly and say something like, "Hey, slight correction" and then continue with the conversation. When you do the corrections please do them in English.

Your first message should be you introducing yourself and asking me how I am doing. You should do this in Romanian.
`;

let mediaRecorder;
const textToSpeechSource = new ReplaySubject(1);
const onDataAvailableSource = new ReplaySubject(1);

const audioBlob$ = onDataAvailableSource.pipe(
  map((x) => x.data),
  map((chunks) => new Blob([chunks], { type: "audio/wav" })),
  tap((x) => console.log(`Chunk ${x.size}`)),
  shareReplay(1)
);

audioBlob$.subscribe();

const onStopSource = new ReplaySubject(1);
const onStartSource = new ReplaySubject(1);

const conversationSource = new ReplaySubject(1);

navigator.mediaDevices.getUserMedia({ audio: true }).then((x) => {
  mediaRecorder = new MediaRecorder(x);
  mediaRecorder.ondataavailable = (e) => onDataAvailableSource.next(e);
  mediaRecorder.onstop = (e) => onStopSource.next(e);
  mediaRecorder.onstart = (e) => onStartSource.next(e);
});

const recordButton = document.querySelector('#record-button')
const conversationBox = document.querySelector("#conversation-box");

const speechToText$ = onStopSource
  .pipe(
    switchMap((x) => audioBlob$.pipe(take(1))),
    switchMap((blob) => {
      const fd = new FormData();
      fd.append("audio", blob, "audio.wav"); 

      return fetch("/stt", { method: "POST", body: fd })
    }),
    switchMap((x) => x.text()),
    catchError(() => of("I couldn't hear you, could you say that again?"))
  )

const conversation$ = conversationSource.pipe(
  map((x) => x.data),
  scan((a, b) => [...a, b], [{ role: "system", content: OPENAI_PROMPT }]),
  shareReplay(1)
);

const openaiInput$ = conversation$.pipe(
  map((x) => x),
  shareReplay(1)
)

const makeOpenAIRequest$ = conversationSource.pipe(
  filter((x) => x.command === 'RESOLVE'),
  withLatestFrom(openaiInput$),
  tap((x) => console.log("SENDING", x)),
  map(([_, messages]) => ({
    model: 'gpt-4',
    messages
  })),
  tap((x) => {
    console.log('REQ', x);
  }),
  switchMap((m) => fetch("https://api.openai.com/v1/chat/completions", {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(m)
  })),
  switchMap((x) => x.json()),
  map((x) => (x.choices ?? [])[0]),
  filter((x) => x !== undefined),
  map((x) => x.message)
);

makeOpenAIRequest$.subscribe((data) => {
  textToSpeechSource.next(data.content);
  conversationSource.next({
    data,
    command: 'ADD'
  })
});

const recordButtonPress = fromEvent(recordButton, 'click');

const recordButtonState$ = recordButtonPress
  .pipe(scan((a) => !a, false))

const recordButtonOn$ = recordButtonState$.pipe(
  filter((x) => x === true)
)

const recordButtonOff$ = recordButtonState$.pipe(
  filter((x) => x === false)
)

recordButtonOn$.subscribe(() => {
  recordButton.innerText = "Stop";
  mediaRecorder.start();
});

recordButtonOff$.subscribe((x) => {
  recordButton.innerText = "Record";
  mediaRecorder.stop();
});

conversation$
  .pipe(
    map((x) => x.slice(1)),
    map((x) => x.reduce((a, b) => a + (
      b.role === 'assist'
      ? `
      <div class="border-b w-full p-4">
        <span class="mr-auto">${b.content}</span>
      </div>
      `
      : `
      <div class="border-b w-full p-4">
        <span class="ml-auto">${b.content}</span>
      </div>
      `
    ), ''))
  )
  .subscribe((x) => {
    // console.log("UPDATE CONVO", x);
    conversationBox.innerHTML = x;
  });

textToSpeechSource
  .pipe(
    switchMap((text) => {
      return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, { 
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVEN_LABS_KEY
        },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", "voice_settings":{"similarity_boost":0.5,"stability":0.5}})
      })
    }),
    switchMap((x) => x.blob()),
    map((x) => URL.createObjectURL(x))
  )
  .subscribe((blob) => {
    new Audio(blob).play();
  })

speechToText$.subscribe((content) => {
  console.log(content);
  conversationSource.next({ data: { role: 'user', content }, command: 'RESOLVE' });
});
