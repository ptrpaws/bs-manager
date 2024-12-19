import { BsmButton, BsmButtonType } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { cn } from "renderer/helpers/css-class.helpers";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";

type BasicModalOptions = {
    title: string;
    image: string;
    body?: string;
    buttons?: {
        id: string;
        text: string;
        type: BsmButtonType,
        /**
         * true - ModalExitCode.COMPLETED
         * undefined/false - ModalExitCode.CANCELED
         */
        onClick?: () => boolean;
    }[];
    buttonsLayout?: "row" | "column";
};

export const BasicModal: ModalComponent<BasicModalOptions["buttons"][0]["id"], BasicModalOptions> = ({ resolver, options: {
    data: { title, image, body, buttons, buttonsLayout = "column" }
} }) => {

    const t = useTranslationV2();

    const handleClick = (button: BasicModalOptions["buttons"][0]) => {
        resolver({
            exitCode: button.onClick?.()
                ? ModalExitCode.COMPLETED
                : ModalExitCode.CANCELED,
            data: button.id
        });
    }

    return (
        <form className="text-gray-900 dark:text-white">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t.text(title)}</h1>
            <BsmImage className="mx-auto h-24" image={image} />
            { body && <p className="w-full">{t.text(body)}</p> }
            <div className={cn("grid gap-2 mt-4")} style={{ gridAutoFlow: buttonsLayout, ...(buttonsLayout === "row" ? { gridTemplateRows: `repeat(${buttons.length}, 1fr)` } : { gridTemplateColumns: `repeat(${buttons.length}, 1fr)` }) }}>
                {buttons.map(button => (
                    <BsmButton
                        key={button.id}
                        typeColor={button.type}
                        className="h-8 rounded-md text-center flex justify-center items-center"
                        onClick={() => handleClick(button)}
                        withBar={false}
                        text={button.text}
                    />
                ))}
            </div>
        </form>
    );
};
